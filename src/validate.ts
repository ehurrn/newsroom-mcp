import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MasterFile, Evidence, Claim } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const schema = require(resolve(__dirname, '..', 'schema', 'master-file.schema.json'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

export function assertSchemaValid(data: unknown): asserts data is MasterFile {
  if (!validateSchema(data)) {
    const errors = (validateSchema.errors ?? [])
      .map((e) => `  ${e.instancePath || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`master-file.json schema violation:\n${errors}`);
  }
}

/** True if the evidence item's Admiralty grade meets the A1/A2 publication standard. */
export function isA1orA2(ev: Evidence): boolean {
  return ev.reliability === 'A' && (ev.credibility === '1' || ev.credibility === '2');
}

/**
 * Verify the publishable gate: a claim may be marked publishable only if:
 *   - status is 'corroborated' (two independent sources), OR
 *   - status is 'single-source' AND at least one linked evidence item is A1 or A2.
 *
 * Also: defamation_risk 'high' requires comment_requested === true.
 */
export function assertPublishableGate(
  claim: Claim,
  allEvidence: MasterFile['evidence'],
): void {
  if (!claim.publishable) return;

  const linked = (claim.evidence_ids ?? [])
    .map((id: string) => allEvidence.find((e: Evidence) => e.id === id))
    .filter(Boolean) as Evidence[];

  const meetsCorroborated = claim.status === 'corroborated';
  const meetsSingleSource =
    claim.status === 'single-source' && linked.some(isA1orA2);

  if (!meetsCorroborated && !meetsSingleSource) {
    throw new Error(
      `Claim ${claim.id} cannot be marked publishable: ` +
      `status is '${claim.status}' and no linked evidence meets A1/A2 grade. ` +
      `Publishable requires: corroborated (two independent sources) OR single-source with ≥1 A1/A2 item.`,
    );
  }

  if (claim.defamation_risk === 'high' && !claim.comment_requested) {
    throw new Error(
      `Claim ${claim.id} has defamation_risk 'high' and cannot be published ` +
      `until comment_requested is set to true (subject must be offered right of reply).`,
    );
  }
}

/** Verify that all id references in the file point to existing records. */
export function assertReferentialIntegrity(data: MasterFile): void {
  const entityIds = new Set(data.entities.map((e: { id: string }) => e.id));
  const evidenceIds = new Set(data.evidence.map((e: { id: string }) => e.id));

  for (const claim of data.claims) {
    for (const eid of claim.entity_ids ?? []) {
      if (!entityIds.has(eid))
        throw new Error(`Claim ${claim.id} references unknown entity ${eid}`);
    }
    for (const did of claim.evidence_ids ?? []) {
      if (!evidenceIds.has(did))
        throw new Error(`Claim ${claim.id} references unknown evidence ${did}`);
    }
  }

  for (const rel of data.relationships ?? []) {
    if (!entityIds.has(rel.from))
      throw new Error(`Relationship ${rel.id} references unknown entity ${rel.from}`);
    if (!entityIds.has(rel.to))
      throw new Error(`Relationship ${rel.id} references unknown entity ${rel.to}`);
    for (const did of rel.evidence_ids ?? []) {
      if (!evidenceIds.has(did))
        throw new Error(`Relationship ${rel.id} references unknown evidence ${did}`);
    }
  }
}
