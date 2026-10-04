import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { analyzeFile, normalizePath } from './complexity-metrics.ts';
import type { AnalyzedFile, ComplexityModule } from './complexity-policy.ts';

export function resolveChangedFiles(
  rootDir: string,
  baseRef: string,
  headRef: string
): Set<string> {
  const runDiff = (range: string): string =>
    execFileSync('git', ['diff', '--name-only', '--diff-filter=ACDMR', range], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();

  let output = '';

  try {
    output = runDiff(`${baseRef}...${headRef}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('no merge base')) {
      throw error;
    }
    output = runDiff(`${baseRef}..${headRef}`);
  }

  if (output.length === 0) {
    return new Set<string>();
  }

  return new Set(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(normalizePath)
  );
}

function globToRegExp(pattern: string): RegExp {
  let regex = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];
    const charAfterNext = pattern[index + 2];

    if (char === '*' && nextChar === '*' && charAfterNext === '/') {
      regex += '(?:.*/)?';
      index += 2;
      continue;
    }

    if (char === '*' && nextChar === '*') {
      regex += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      regex += '[^/]*';
      continue;
    }

    if (char === '?') {
      regex += '[^/]';
      continue;
    }

    regex += /[|\\{}()[\]^$+?.]/.test(char) ? `\\${char}` : char;
  }

  regex += '$';
  return new RegExp(regex);
}

function createMatcher(patterns: string[]): (candidate: string) => boolean {
  const regexes = patterns.map((pattern) => globToRegExp(pattern));
  return (candidate: string): boolean => regexes.some((regex) => regex.test(candidate));
}

function walkFiles(dirPath: string, results: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'dist' ||
        entry.name === 'coverage' ||
        entry.name === 'node_modules' ||
        entry.name === '.git'
      ) {
        continue;
      }
      walkFiles(entryPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(mts|ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
      continue;
    }

    results.push(entryPath);
  }

  return results;
}

export function resolveModuleFiles(rootDir: string, modules: ComplexityModule[]): AnalyzedFile[] {
  const allFiles = walkFiles(rootDir).map((filePath) =>
    normalizePath(path.relative(rootDir, filePath))
  );
  const analyzedFiles: AnalyzedFile[] = [];

  const compiledModules = modules.map((moduleConfig) => ({
    module: moduleConfig,
    include: createMatcher(moduleConfig.include),
    exclude: createMatcher(moduleConfig.exclude ?? []),
    priority: moduleConfig.priority ?? 0,
  }));

  for (const relativePath of allFiles) {
    const matchingModules = compiledModules
      .filter(({ include, exclude }) => include(relativePath) && !exclude(relativePath))
      .sort((left, right) => right.priority - left.priority);

    if (matchingModules.length === 0) {
      continue;
    }

    const selectedModule = matchingModules[0];
    const conflictingModule = matchingModules.find(
      ({ module, priority }) =>
        module.id !== selectedModule.module.id && priority === selectedModule.priority
    );

    if (conflictingModule) {
      throw new Error(
        `Complexity module overlap detected: ${relativePath} matches both ${selectedModule.module.id} and ${conflictingModule.module.id}`
      );
    }

    analyzedFiles.push({
      module: selectedModule.module,
      metrics: analyzeFile(path.join(rootDir, relativePath), relativePath),
    });
  }

  return analyzedFiles.sort((left, right) =>
    left.metrics.filePath.localeCompare(right.metrics.filePath)
  );
}
