import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const walk = (dir) => {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const testFiles = walk('packages/data/src').filter(
  (path) => path.endsWith('.test.ts') && !path.endsWith('.vitest.test.ts')
);

if (testFiles.length === 0) {
  console.log('No node:test files found for @sva/data.');
  process.exit(0);
}

const result = spawnSync('node', ['--import', 'tsx', '--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
