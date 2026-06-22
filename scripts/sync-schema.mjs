#!/usr/bin/env node
// Refreshes the vendored schema copy from the sibling newsroom-extension repo.
// Usage: node scripts/sync-schema.mjs [/path/to/newsroom-extension]
// Then re-run: npm run codegen

import { copyFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const pluginDir = process.argv[2] ?? resolve(ROOT, '..', 'newsroom-extension');
const SRC = resolve(pluginDir, 'skills', 'investigative-journalist', 'schemas', 'master-file.schema.json');
const DST = resolve(ROOT, 'schema', 'master-file.schema.json');

try {
  statSync(SRC);
} catch {
  console.error(`Schema not found at: ${SRC}`);
  console.error('Pass the path to your newsroom-extension checkout as the first argument.');
  process.exit(1);
}

copyFileSync(SRC, DST);
console.log(`Synced schema from ${SRC}`);
console.log('Re-run "npm run codegen" to regenerate src/types.ts');
