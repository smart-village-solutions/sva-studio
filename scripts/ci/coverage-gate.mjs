#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'tsx', 'scripts/ci/coverage-gate.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
