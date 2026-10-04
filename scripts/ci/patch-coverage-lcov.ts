import fs from 'node:fs';
import path from 'node:path';
import { findCoverageArtifacts } from './coverage-gate.ts';
import { resolveLcovSourcePath } from './new-code-coverage-scope.ts';

interface FileLineCoverage {
  coveredLines: Set<number>;
  instrumentedLines: Set<number>;
}

interface LcovCandidate {
  lcovPath: string;
  projectRoot: string;
  priority: number;
  modifiedAt: number;
}

function findNxCacheCoverageArtifacts(
  rootDir: string,
  projectRoots: readonly string[],
  fileName: string
): string[] {
  const nxCacheRoot = path.join(rootDir, '.nx', 'cache');
  if (!fs.existsSync(nxCacheRoot)) {
    return [];
  }

  const relativeProjectRoots = projectRoots.map((projectRoot) =>
    path.relative(rootDir, projectRoot)
  );
  const results: string[] = [];

  for (const entry of fs.readdirSync(nxCacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    for (const relativeProjectRoot of relativeProjectRoots) {
      const candidate = path.join(
        nxCacheRoot,
        entry.name,
        relativeProjectRoot,
        'coverage',
        fileName
      );
      if (fs.existsSync(candidate)) {
        results.push(candidate);
      }
    }
  }

  return results;
}

export function parseLcovLineCoverage(
  rootDir: string,
  projectRoots: readonly string[]
): Map<string, FileLineCoverage> {
  const workspaceLcovFiles = projectRoots.flatMap((projectRoot) =>
    findCoverageArtifacts(projectRoot, 'lcov.info')
  );
  const cacheLcovFiles = findNxCacheCoverageArtifacts(rootDir, projectRoots, 'lcov.info');
  const selectedLcovFiles = selectLcovArtifacts(rootDir, [
    ...workspaceLcovFiles,
    ...cacheLcovFiles,
  ]);
  const coverageByFile = new Map<string, FileLineCoverage>();

  for (const candidate of selectedLcovFiles) {
    const { lcovPath, projectRoot } = candidate;
    const contents = fs.readFileSync(lcovPath, 'utf8');
    const records = contents.split('end_of_record');

    for (const record of records) {
      const trimmed = record.trim();
      if (!trimmed) {
        continue;
      }

      const sfMatch = trimmed.match(/^SF:(.+)$/m);
      if (!sfMatch) {
        continue;
      }

      const sourceFilePath = sfMatch[1].trim();
      const normalizedFilePath = resolveLcovSourcePath(rootDir, projectRoot, sourceFilePath);
      const coveredLines = new Set<number>();
      const instrumentedLines = new Set<number>();

      for (const entryLine of trimmed.split('\n')) {
        const daMatch = entryLine.match(/^DA:(\d+),(\d+)/);
        if (!daMatch) {
          continue;
        }

        const lineNumber = Number(daMatch[1]);
        const hits = Number(daMatch[2]);
        instrumentedLines.add(lineNumber);
        if (hits > 0) {
          coveredLines.add(lineNumber);
        }
      }

      coverageByFile.set(normalizedFilePath, {
        coveredLines,
        instrumentedLines,
      });
    }
  }

  return coverageByFile;
}

function resolveWorkspaceProjectRootFromCachePath(
  rootDir: string,
  lcovPath: string
): string | null {
  const normalizedRoot = rootDir.split(path.sep).join('/').replace(/\/$/, '');
  const escapedRoot = normalizedRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalizedPath = lcovPath.split(path.sep).join('/');
  const pattern = new RegExp(
    String.raw`^${escapedRoot}/\.nx/cache/[^/]+/(apps|packages)/([^/]+)/coverage/lcov\.info$`
  );
  const match = pattern.exec(normalizedPath);
  if (!match) {
    return null;
  }

  return path.join(rootDir, match[1], match[2]);
}

function selectLcovArtifacts(rootDir: string, lcovFiles: string[]): LcovCandidate[] {
  const bestByProjectRoot = new Map<string, LcovCandidate>();

  for (const lcovPath of lcovFiles) {
    const isCacheArtifact = lcovPath.includes(`${path.sep}.nx${path.sep}cache${path.sep}`);
    const resolvedProjectRoot =
      (isCacheArtifact ? resolveWorkspaceProjectRootFromCachePath(rootDir, lcovPath) : null) ??
      path.dirname(path.dirname(lcovPath));
    const priority = isCacheArtifact ? 1 : 2;
    const modifiedAt = fs.statSync(lcovPath).mtimeMs;
    const existing = bestByProjectRoot.get(resolvedProjectRoot);

    if (!existing) {
      bestByProjectRoot.set(resolvedProjectRoot, {
        lcovPath,
        projectRoot: resolvedProjectRoot,
        priority,
        modifiedAt,
      });
      continue;
    }

    if (
      priority > existing.priority ||
      (priority === existing.priority && modifiedAt > existing.modifiedAt)
    ) {
      bestByProjectRoot.set(resolvedProjectRoot, {
        lcovPath,
        projectRoot: resolvedProjectRoot,
        priority,
        modifiedAt,
      });
    }
  }

  return [...bestByProjectRoot.values()];
}
