/**
 * init-hook — installs the validate-evidence pre-commit hook into the
 * investigation workspace's .git/hooks directory.
 *
 * Called via: npx newsroom-mcp init-hook
 */

import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const HOOK_CONTENT = `#!/bin/sh
# newsroom-mcp evidence gate — installed by: npx newsroom-mcp init-hook
# Blocks commits when a cited publishable claim lacks A1/A2 evidence.
npx newsroom-mcp validate
`;

export function installHook(workspaceDir: string = process.cwd()): void {
  const gitDir = resolve(workspaceDir, '.git');
  if (!existsSync(gitDir)) {
    console.error(
      `✗ No .git directory found in ${workspaceDir}.\n` +
      `  Run "git init" inside your investigation workspace first.`,
    );
    process.exit(1);
  }

  const hooksDir = resolve(gitDir, 'hooks');
  mkdirSync(hooksDir, { recursive: true });

  const hookPath = resolve(hooksDir, 'pre-commit');
  if (existsSync(hookPath)) {
    console.warn(
      `⚠ A pre-commit hook already exists at ${hookPath}.\n` +
      `  Overwriting — back it up first if it contains other logic.`,
    );
  }

  writeFileSync(hookPath, HOOK_CONTENT, 'utf8');
  chmodSync(hookPath, 0o755);
  console.log(`✓ Pre-commit hook installed at ${hookPath}`);
  console.log('  Run "git commit" to test it in your investigation workspace.');
}
