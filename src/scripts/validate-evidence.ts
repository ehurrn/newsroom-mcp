#!/usr/bin/env node
/**
 * validate-evidence — pre-commit hook script.
 *
 * Scans working/ and drafts/ for cited CLM-NNN ids, loads master-file.json,
 * and verifies every cited publishable claim meets the Admiralty publication rule.
 *
 * Exit 0 = all good. Exit 1 = gate failed (blocks the commit).
 *
 * Usage (standalone): npx newsroom-mcp validate
 * Usage (hook):       installed by `npx newsroom-mcp init-hook`
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { assertSchemaValid, assertPublishableGate, isA1orA2 } from '../validate.js';
import type { MasterFile, Claim, Evidence } from '../types.js';

const CWD = process.cwd();
const MASTER_FILE = resolve(CWD, 'master-file.json');
const SCAN_DIRS = ['working', 'drafts'];

function walkMd(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkMd(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractClaimIds(text: string): string[] {
  const matches = text.matchAll(/\bCLM-[0-9]{3,}\b/g);
  return [...new Set([...matches].map((m) => m[0]))];
}

export function main(): void {
  if (!existsSync(MASTER_FILE)) {
    // No master-file in this workspace — nothing to validate.
    process.exit(0);
  }

  let data: MasterFile;
  try {
    data = JSON.parse(readFileSync(MASTER_FILE, 'utf8')) as MasterFile;
    assertSchemaValid(data);
  } catch (err) {
    console.error(`\n✗ master-file.json is invalid:\n  ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Collect all CLM-ids cited in markdown drafts.
  const cited = new Set<string>();
  for (const dir of SCAN_DIRS) {
    const fullDir = resolve(CWD, dir);
    for (const file of walkMd(fullDir)) {
      const text = readFileSync(file, 'utf8');
      for (const id of extractClaimIds(text)) cited.add(id);
    }
  }

  if (cited.size === 0) process.exit(0); // nothing cited — nothing to check

  const claimMap = new Map(data.claims.map((c: Claim) => [c.id, c]));
  const errors: string[] = [];

  for (const id of cited) {
    const claim = claimMap.get(id);
    if (!claim) {
      errors.push(`  ${id}: cited in a draft but not found in master-file.json`);
      continue;
    }
    if (!claim.publishable) continue; // not flagged publishable — skip gate

    try {
      assertPublishableGate(claim, data.evidence);
    } catch (err) {
      errors.push(`  ${(err as Error).message}`);
    }
  }

  // Summarise evidence coverage for any cited publishable claims.
  const evidenceMap = new Map(data.evidence.map((e: Evidence) => [e.id, e]));
  for (const id of cited) {
    const claim = claimMap.get(id);
    if (!claim?.publishable) continue;
    const linked = (claim.evidence_ids ?? [])
      .map((eid: string) => evidenceMap.get(eid))
      .filter(Boolean);
    const a1a2 = linked.filter((e: Evidence | undefined) => e && isA1orA2(e));
    if (a1a2.length === 0 && claim.status !== 'corroborated') {
      errors.push(
        `  ${id}: publishable claim has no A1/A2 evidence and status is not 'corroborated'`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n✗ Evidence gate failed — commit blocked:\n');
    for (const e of errors) console.error(e);
    console.error(
      '\nFix: update master-file.json via newsroom-mcp tools, or set publishable:false ' +
      'until evidence meets the A1/A2 or corroborated standard.\n',
    );
    process.exit(1);
  }

  console.log(`✓ Evidence gate passed (${cited.size} claim(s) verified)`);
  process.exit(0);
}

main();
