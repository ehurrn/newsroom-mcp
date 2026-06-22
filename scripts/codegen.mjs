#!/usr/bin/env node
// Generates src/types.ts from the vendored schema copy.
// Run via: npm run codegen

import { compileFromFile } from 'json-schema-to-typescript';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMA = resolve(ROOT, 'schema', 'master-file.schema.json');
const OUT = resolve(ROOT, 'src', 'types.ts');

console.log(`Compiling schema → ${OUT}`);
const ts = await compileFromFile(SCHEMA, {
  bannerComment: '/* AUTO-GENERATED — do not edit by hand. Run: npm run codegen */',
  style: { semi: true, singleQuote: true },
  unknownAny: false,
});
mkdirSync(resolve(ROOT, 'src'), { recursive: true });
writeFileSync(OUT, ts);
console.log('Done.');
