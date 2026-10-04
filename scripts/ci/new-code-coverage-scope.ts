import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertCoveragePolicy, readJson, type CoveragePolicy } from './coverage-gate.ts';

export interface ChangedFile {
  path: string;
  changedLines: number[];
}

const gitDiffMaxBuffer = 32 * 1024 * 1024;

export function loadPolicy(rootDir: string): CoveragePolicy {
  const policyPath = path.join(rootDir, 'tooling/testing/coverage-policy.json');
  const policy = readJson<unknown>(policyPath);
  assertCoveragePolicy(policy);
  return policy;
}

export function resolveProjectRoots(rootDir: string, policy: CoveragePolicy): string[] {
  const exemptProjects = new Set(policy.exemptProjects ?? []);
  const newCodeExemptProjects = new Set(
    (policy as CoveragePolicy & { newCodeExemptProjects?: string[] }).newCodeExemptProjects ?? []
  );
  const projectNames = Object.keys(policy.perProjectFloors ?? {}).filter(
    (projectName) => !exemptProjects.has(projectName) && !newCodeExemptProjects.has(projectName)
  );
  const roots = projectNames.flatMap((projectName) => {
    const appRoot = path.join(rootDir, 'apps', projectName);
    if (fs.existsSync(appRoot)) {
      return [appRoot];
    }

    const packageRoot = path.join(rootDir, 'packages', projectName);
    if (fs.existsSync(packageRoot)) {
      return [packageRoot];
    }

    return [];
  });

  return roots.sort();
}

export function normalizeRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

export function resolveLcovSourcePath(
  rootDir: string,
  projectRoot: string,
  sourceFilePath: string
): string {
  const absoluteFilePath = path.isAbsolute(sourceFilePath)
    ? sourceFilePath
    : path.join(projectRoot, sourceFilePath);

  const extension = path.extname(absoluteFilePath);
  const extensionFallbacks =
    extension === '.js'
      ? ['.ts', '.tsx']
      : extension === '.jsx'
        ? ['.tsx', '.ts']
        : extension === '.mjs'
          ? ['.mts', '.ts']
          : [];

  for (const fallbackExtension of extensionFallbacks) {
    const fallbackPath = absoluteFilePath.slice(0, -extension.length) + fallbackExtension;
    if (fs.existsSync(fallbackPath)) {
      return normalizeRelativePath(rootDir, fallbackPath);
    }
  }

  if (fs.existsSync(absoluteFilePath)) {
    return normalizeRelativePath(rootDir, absoluteFilePath);
  }

  return normalizeRelativePath(rootDir, absoluteFilePath);
}

function isCoverableSourceFile(filePath: string): boolean {
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return false;
  }

  if (filePath.endsWith('.d.ts')) {
    return false;
  }

  if (
    filePath.includes('/node_modules/') ||
    filePath.includes('/dist/') ||
    filePath.includes('/build/') ||
    filePath.includes('/coverage/') ||
    filePath.includes('/.nx/') ||
    filePath.includes('/.turbo/') ||
    filePath.includes('/__tests__/') ||
    filePath.includes('/__mocks__/') ||
    filePath.includes('/test-utils/') ||
    filePath.includes('/examples/') ||
    filePath.includes('/e2e/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/tools/')
  ) {
    return false;
  }

  return !/(\.test|\.spec|\.config)\.(ts|tsx|js|jsx)$/.test(filePath);
}

export function listChangedFiles(
  rootDir: string,
  baseRef: string,
  headRef: string,
  projectRoots: string[]
): ChangedFile[] {
  if (projectRoots.length === 0) {
    return [];
  }

  const relativeRoots = projectRoots.map((projectRoot) =>
    normalizeRelativePath(rootDir, projectRoot)
  );
  const diffArgs = [
    'diff',
    '--unified=0',
    '--diff-filter=AM',
    `${baseRef}...${headRef}`,
    '--',
    ...relativeRoots,
  ];
  const result = spawnSync('git', diffArgs, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: gitDiffMaxBuffer,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${diffArgs.join(' ')} failed`);
  }

  const files = new Map<string, Set<number>>();
  let currentFile: string | null = null;
  let nextNewLineNumber: number | null = null;

  for (const line of result.stdout.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      nextNewLineNumber = null;
      if (!files.has(currentFile)) {
        files.set(currentFile, new Set<number>());
      }
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      nextNewLineNumber = Number(hunkMatch[1]);
      continue;
    }

    if (!currentFile || nextNewLineNumber === null) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      files.get(currentFile)?.add(nextNewLineNumber);
      nextNewLineNumber += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      nextNewLineNumber += 1;
    }
  }

  return [...files.entries()]
    .map(([filePath, lines]) => ({
      path: filePath,
      changedLines: [...lines].sort((left, right) => left - right),
    }))
    .filter((entry) => entry.changedLines.length > 0 && isCoverableSourceFile(entry.path));
}
