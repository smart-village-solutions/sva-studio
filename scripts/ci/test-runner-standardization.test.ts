import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = dirname(CURRENT_FILE);
const REPO_ROOT = resolve(CURRENT_DIR, '../..');
const SCAN_DIRECTORIES = ['apps', 'packages', 'scripts'] as const;
const NODE_TEST_PATTERNS = ["from 'node:test'", 'from "node:test"', "require('node:test')", 'require("node:test")'];
const SKIP_DIRECTORY_NAMES = new Set(['coverage', 'dist', 'node_modules', 'tmp']);
const THIS_FILE = resolve(CURRENT_FILE);

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
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const offenders = Object.entries(packageJson.scripts ?? {})
      .filter(([, command]) => usesNodeTestRunner(command))
      .map(([name, command]) => `${name}: ${command}`);

    expect(offenders).toEqual([]);
  });

  it('detects node test runners even when node flags come before --test', () => {
    expect(usesNodeTestRunner('node --test scripts/ci/example.test.ts')).toBe(true);
    expect(usesNodeTestRunner('node --import tsx --test scripts/ci/example.test.ts')).toBe(true);
    expect(usesNodeTestRunner('pnpm exec node --import tsx --test scripts/ci/example.test.ts')).toBe(true);
    expect(usesNodeTestRunner('NODE_OPTIONS=--trace-warnings node --import tsx --test scripts/ci/example.test.ts')).toBe(
      true
    );
    expect(usesNodeTestRunner('pnpm exec vitest run scripts/ci/example.test.ts')).toBe(false);
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

function usesNodeTestRunner(command: string): boolean {
  return splitCommandSegments(command).some((segment) => {
    const tokens = segment.trim().split(/\s+/u).filter(Boolean);

    if (tokens.length === 0) {
      return false;
    }

    let tokenIndex = 0;

    while (tokens[tokenIndex]?.includes('=') && !tokens[tokenIndex]?.startsWith('--')) {
      tokenIndex += 1;
    }

    if (
      (tokens[tokenIndex] === 'pnpm' || tokens[tokenIndex] === 'npm' || tokens[tokenIndex] === 'yarn') &&
      tokens[tokenIndex + 1] === 'exec'
    ) {
      tokenIndex += 2;
    } else if (tokens[tokenIndex] === 'npx') {
      tokenIndex += 1;
    }

    if (tokens[tokenIndex] !== 'node') {
      return false;
    }

    return tokens.slice(tokenIndex + 1).includes('--test');
  });
}

function splitCommandSegments(command: string): string[] {
  return command.split(/&&|\|\||;|\n/u);
}
