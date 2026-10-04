import fs from 'node:fs';
import path from 'node:path';
import { assertCoveragePolicy, readJson } from './coverage-policy.ts';
import { toMetricValues, toPct } from './coverage-metrics.ts';
import type {
  CoverageBaseline,
  CoveragePaths,
  CoveragePolicy,
  CoverageSummary,
  FileCoverageMetrics,
  LoadedCoverageData,
  MetricFloors,
} from './coverage-policy.ts';

export function findCoverageSummaries(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return results;
  }

  if (isWorkspaceProjectRoot(dir)) {
    const summaryPath = path.join(dir, 'coverage', 'coverage-summary.json');
    if (fs.existsSync(summaryPath)) {
      results.push(summaryPath);
    }
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.nx') {
        continue;
      }
      findCoverageSummaries(entryPath, results);
      continue;
    }

    const isCoverageSummary =
      entry.isFile() &&
      entry.name === 'coverage-summary.json' &&
      entryPath.includes(`${path.sep}coverage${path.sep}`);

    if (isCoverageSummary) {
      results.push(entryPath);
    }
  }

  return results;
}

export function findCoverageArtifacts(
  dir: string,
  fileName: string,
  results: string[] = []
): string[] {
  if (!fs.existsSync(dir)) {
    return results;
  }

  if (isWorkspaceProjectRoot(dir)) {
    const artifactPath = path.join(dir, 'coverage', fileName);
    if (fs.existsSync(artifactPath)) {
      results.push(artifactPath);
    }
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.nx') {
        continue;
      }
      findCoverageArtifacts(entryPath, fileName, results);
      continue;
    }

    const isMatchingArtifact =
      entry.isFile() &&
      entry.name === fileName &&
      entryPath.includes(`${path.sep}coverage${path.sep}`);

    if (isMatchingArtifact) {
      results.push(entryPath);
    }
  }

  return results;
}

export function projectFromCoveragePath(coverageSummaryPath: string): string | null {
  const normalized = coverageSummaryPath.split(path.sep).join('/');
  const marker = '/coverage/coverage-summary.json';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const projectRoot = normalized.slice(0, markerIndex);
  return path.basename(projectRoot);
}

function isWorkspaceProjectRoot(projectRoot: string): boolean {
  return ['project.json', 'package.json'].some((manifest) =>
    fs.existsSync(path.join(projectRoot, manifest))
  );
}

function resolveCoveragePaths(rootDir: string): CoveragePaths {
  return {
    rootDir,
    policyPath: path.join(rootDir, 'tooling/testing/coverage-policy.json'),
    baselinePath: path.join(rootDir, 'tooling/testing/coverage-baseline.json'),
    workspaceRoots: ['apps', 'packages'].map((dir) => path.join(rootDir, dir)),
  };
}

export function loadCoverageData(rootDir: string): LoadedCoverageData {
  const paths = resolveCoveragePaths(rootDir);
  if (!fs.existsSync(paths.policyPath)) {
    throw new Error(`Coverage policy not found: ${paths.policyPath}`);
  }

  const rawPolicy = readJson<unknown>(paths.policyPath);
  assertCoveragePolicy(rawPolicy);

  const baseline = fs.existsSync(paths.baselinePath)
    ? readJson<CoverageBaseline>(paths.baselinePath)
    : { projects: {} };

  const summaries = paths.workspaceRoots.flatMap((dir) => findCoverageSummaries(dir));
  const projects = summaries.reduce<Record<string, MetricFloors>>((acc, summaryPath) => {
    const projectName = projectFromCoveragePath(summaryPath);
    if (!projectName) {
      return acc;
    }

    const projectRoot = path.dirname(path.dirname(summaryPath));
    if (!isWorkspaceProjectRoot(projectRoot)) {
      return acc;
    }

    acc[projectName] = toMetricValues(readJson<CoverageSummary>(summaryPath), projectRoot);
    return acc;
  }, {});

  const lcovFiles = paths.workspaceRoots.flatMap((dir) => findCoverageArtifacts(dir, 'lcov.info'));
  const fileCoverageByProject = lcovFiles.reduce<
    Record<string, Record<string, FileCoverageMetrics>>
  >((acc, lcovPath) => {
    const projectName = projectFromCoveragePath(
      lcovPath.replace(/lcov\.info$/, 'coverage-summary.json')
    );
    if (!projectName) {
      return acc;
    }

    const projectRoot = path.dirname(path.dirname(lcovPath));
    if (!isWorkspaceProjectRoot(projectRoot)) {
      return acc;
    }

    acc[projectName] = parseLcovInfo(rootDir, lcovPath);
    return acc;
  }, {});

  return {
    paths,
    policy: rawPolicy,
    baseline,
    projects,
    fileCoverageByProject,
  };
}

function parseLcovInfo(rootDir: string, lcovPath: string): Record<string, FileCoverageMetrics> {
  const projectRoot = path.dirname(path.dirname(lcovPath));
  const contents = fs.readFileSync(lcovPath, 'utf8');
  const records = contents.split('end_of_record');
  const fileCoverage: Record<string, FileCoverageMetrics> = {};

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
    const absoluteFilePath = path.isAbsolute(sourceFilePath)
      ? sourceFilePath
      : path.join(projectRoot, sourceFilePath);
    const normalizedFilePath = normalizeLcovSourcePath(rootDir, absoluteFilePath);

    const lf = readLcovCounter(trimmed, 'LF');
    const lh = readLcovCounter(trimmed, 'LH');
    const fnf = readLcovCounter(trimmed, 'FNF');
    const fnh = readLcovCounter(trimmed, 'FNH');
    const brf = readLcovCounter(trimmed, 'BRF');
    const brh = readLcovCounter(trimmed, 'BRH');

    fileCoverage[normalizedFilePath] = {
      lines: toPct(lh, lf),
      functions: toPct(fnh, fnf),
      branches: toPct(brh, brf),
    };
  }

  return fileCoverage;
}

const tsTwinCache = new Map<string, string | null>();

function normalizeLcovSourcePath(rootDir: string, absoluteFilePath: string): string {
  const relativeFilePath = path.relative(rootDir, absoluteFilePath).split(path.sep).join('/');
  const tsTwinPath = resolveTypeScriptTwin(rootDir, absoluteFilePath);

  if (tsTwinPath) {
    return path.relative(rootDir, tsTwinPath).split(path.sep).join('/');
  }

  return relativeFilePath;
}

function resolveTypeScriptTwin(rootDir: string, absoluteFilePath: string): string | null {
  const cached = tsTwinCache.get(absoluteFilePath);
  if (cached !== undefined) {
    return cached;
  }

  const extension = path.extname(absoluteFilePath);
  if (extension !== '.js' && extension !== '.jsx') {
    tsTwinCache.set(absoluteFilePath, null);
    return null;
  }

  const twinPath = absoluteFilePath.replace(/\.jsx?$/, extension === '.jsx' ? '.tsx' : '.ts');
  if (!fs.existsSync(twinPath)) {
    tsTwinCache.set(absoluteFilePath, null);
    return null;
  }

  const relativeTwinPath = path.relative(rootDir, twinPath).split(path.sep).join('/');
  if (!/^(apps|packages)\//.test(relativeTwinPath)) {
    tsTwinCache.set(absoluteFilePath, null);
    return null;
  }

  tsTwinCache.set(absoluteFilePath, twinPath);
  return twinPath;
}

function readLcovCounter(record: string, label: string): number {
  const match = record.match(new RegExp(`^${label}:(\\d+)$`, 'm'));
  return match ? Number(match[1]) : 0;
}
