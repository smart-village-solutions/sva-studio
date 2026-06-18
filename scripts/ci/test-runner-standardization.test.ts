import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SCAN_DIRECTORIES = ['apps', 'packages', 'scripts'] as const;
const NODE_TEST_PATTERNS = ["from 'node:test'", 'from "node:test"', "require('node:test')", 'require("node:test")'];
const SKIP_DIRECTORY_NAMES = new Set(['coverage', 'dist', 'node_modules', 'tmp']);
const THIS_FILE = resolve(import.meta.filename);

describe('test runner standardization', () => {
  it('keeps app, package, and script tests on vitest', () => {
    const offenders = collectTypeScriptFiles(SCAN_DIRECTORIES)
      .filter((filePath) => resolve(filePath) !== THIS_FILE)
      .filter((filePath) => /\.test\.tsx?$/u.test(filePath))
      .filter((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return NODE_TEST_PATTERNS.some((pattern) => source.includes(pattern));
      })
      .map((filePath) => relative(REPO_ROOT, filePath));

    expect(offenders).toEqual([]);
  });

  it('does not use node --test in workspace scripts', () => {
    const packageJson = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');

    expect(packageJson).not.toContain('node --test');
  });
});

function collectTypeScriptFiles(directories: readonly string[]): string[] {
  return directories.flatMap((directory) => walkDirectory(join(REPO_ROOT, directory)));
}

function walkDirectory(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIP_DIRECTORY_NAMES.has(entry)) {
      continue;
    }

    const absolutePath = join(directory, entry);
    let stats;

    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(...walkDirectory(absolutePath));
      continue;
    }

    if (absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx')) {
      files.push(absolutePath);
    }
  }

  return files;
}
