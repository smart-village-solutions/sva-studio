#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type CoverageMetric = 'lines' | 'statements' | 'functions' | 'branches';

export interface MetricFloors {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

export interface CoveragePolicy {
  version: number;
  metrics: CoverageMetric[];
  globalFloors: MetricFloors;
  maxAllowedDropPctPoints: number;
  exemptProjects: string[];
  perProjectFloors: Record<string, MetricFloors>;
  criticalProjects?: Record<string, CriticalCoveragePolicy>;
}

export interface CoverageBaseline {
  projects: Record<string, MetricFloors>;
}

export interface CoverageSummary {
  total?: {
    lines?: { pct?: number };
    statements?: { pct?: number };
    functions?: { pct?: number };
    branches?: { pct?: number };
  };
}

interface GateError {
  scope: 'global' | 'project';
  message: string;
}

interface RunCoverageGateOptions {
  rootDir?: string;
  updateBaseline?: boolean;
  requireSummaries?: boolean;
  stepSummaryPath?: string | null;
}

interface RunCoverageGateResult {
  passed: boolean;
  updatedBaseline: boolean;
  summaryBody: string;
  errors: string[];
  projects: Record<string, MetricFloors>;
}

interface CoveragePaths {
  rootDir: string;
  policyPath: string;
  baselinePath: string;
  workspaceRoots: string[];
}

export interface HotspotCoverageFloors {
  lines?: number;
  functions?: number;
  branches?: number;
}

export interface CriticalCoverageHotspot {
  path: string;
  reason: string;
  metrics: HotspotCoverageFloors;
}

export interface CriticalCoveragePolicy {
  minimumFloors?: Partial<MetricFloors>;
  hotspotFloors?: CriticalCoverageHotspot[];
}

interface FileCoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
}

interface LoadedCoverageData {
  paths: CoveragePaths;
  policy: CoveragePolicy;
  baseline: CoverageBaseline;
  projects: Record<string, MetricFloors>;
  fileCoverageByProject: Record<string, Record<string, FileCoverageMetrics>>;
}

const isTTY = process.stdout.isTTY;
const colorize = (code: string, text: string): string =>
  isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
const colors = {
  green: (text: string): string => colorize('32', text),
  red: (text: string): string => colorize('31', text),
  yellow: (text: string): string => colorize('33', text),
  blue: (text: string): string => colorize('34', text),
  bold: (text: string): string => colorize('1', text),
};

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function isMetricFloors(input: unknown): input is MetricFloors {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.lines === 'number' &&
    typeof candidate.statements === 'number' &&
    typeof candidate.functions === 'number' &&
    typeof candidate.branches === 'number'
  );
}

function isPartialMetricFloors(input: unknown): input is Partial<MetricFloors> {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return ['lines', 'statements', 'functions', 'branches'].every((metric) => {
    const value = candidate[metric];
    return value === undefined || typeof value === 'number';
  });
}

function isHotspotCoverageFloors(input: unknown): input is HotspotCoverageFloors {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return ['lines', 'functions', 'branches'].every((metric) => {
    const value = candidate[metric];
    return value === undefined || typeof value === 'number';
  });
}

export function assertCoveragePolicy(policy: unknown): asserts policy is CoveragePolicy {
  if (!policy || typeof policy !== 'object') {
    throw new TypeError('Invalid coverage policy: expected object');
  }

  const candidate = policy as Record<string, unknown>;
  const metrics = candidate.metrics;
  const validMetric = new Set<CoverageMetric>(['lines', 'statements', 'functions', 'branches']);

  if (!Array.isArray(metrics) || metrics.some((metric) => !validMetric.has(metric as CoverageMetric))) {
    throw new TypeError('Invalid coverage policy: metrics must be an array of coverage metric names');
  }

  if (!isMetricFloors(candidate.globalFloors)) {
    throw new TypeError('Invalid coverage policy: globalFloors must contain numeric metrics');
  }

  if (typeof candidate.maxAllowedDropPctPoints !== 'number') {
    throw new TypeError('Invalid coverage policy: maxAllowedDropPctPoints must be a number');
  }

  if (!Array.isArray(candidate.exemptProjects) || candidate.exemptProjects.some((p) => typeof p !== 'string')) {
    throw new TypeError('Invalid coverage policy: exemptProjects must be an array of strings');
  }

  if (!candidate.perProjectFloors || typeof candidate.perProjectFloors !== 'object') {
    throw new TypeError('Invalid coverage policy: perProjectFloors must be an object');
  }

  const perProjectFloors = candidate.perProjectFloors as Record<string, unknown>;
  for (const [projectName, floors] of Object.entries(perProjectFloors)) {
    if (!isMetricFloors(floors)) {
      throw new TypeError(`Invalid coverage policy: perProjectFloors.${projectName} is invalid`);
    }
  }

  if (candidate.criticalProjects !== undefined) {
    if (!candidate.criticalProjects || typeof candidate.criticalProjects !== 'object') {
      throw new TypeError('Invalid coverage policy: criticalProjects must be an object');
    }

    const criticalProjects = candidate.criticalProjects as Record<string, unknown>;
    for (const [projectName, config] of Object.entries(criticalProjects)) {
      if (!config || typeof config !== 'object') {
        throw new TypeError(`Invalid coverage policy: criticalProjects.${projectName} is invalid`);
      }

      const criticalConfig = config as Record<string, unknown>;
      if (
        criticalConfig.minimumFloors !== undefined &&
        !isPartialMetricFloors(criticalConfig.minimumFloors)
      ) {
        throw new TypeError(
          `Invalid coverage policy: criticalProjects.${projectName}.minimumFloors is invalid`
        );
      }

      if (criticalConfig.hotspotFloors !== undefined) {
        if (!Array.isArray(criticalConfig.hotspotFloors)) {
          throw new TypeError(
            `Invalid coverage policy: criticalProjects.${projectName}.hotspotFloors must be an array`
          );
        }

        for (const hotspot of criticalConfig.hotspotFloors) {
          if (!hotspot || typeof hotspot !== 'object') {
            throw new TypeError(
              `Invalid coverage policy: criticalProjects.${projectName}.hotspotFloors entry is invalid`
            );
          }

          const hotspotConfig = hotspot as Record<string, unknown>;
          if (
            typeof hotspotConfig.path !== 'string' ||
            typeof hotspotConfig.reason !== 'string' ||
            !isHotspotCoverageFloors(hotspotConfig.metrics)
          ) {
            throw new TypeError(
              `Invalid coverage policy: criticalProjects.${projectName}.hotspotFloors entry is invalid`
            );
          }
        }
      }
    }
  }
}

export function findCoverageSummaries(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
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

export function findCoverageArtifacts(dir: string, fileName: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
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
      entry.isFile() && entry.name === fileName && entryPath.includes(`${path.sep}coverage${path.sep}`);

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

export function toMetricValues(summary: CoverageSummary): MetricFloors {
  const total = summary.total ?? {};
  return {
    lines: Number(total.lines?.pct ?? 0),
    statements: Number(total.statements?.pct ?? 0),
    functions: Number(total.functions?.pct ?? 0),
    branches: Number(total.branches?.pct ?? 0),
  };
}

export function mergeGlobal(projectMetricsList: MetricFloors[]): MetricFloors {
  if (projectMetricsList.length === 0) {
    return { lines: 0, statements: 0, functions: 0, branches: 0 };
  }

  const totals = projectMetricsList.reduce<MetricFloors>(
    (acc, current) => ({
      lines: acc.lines + current.lines,
      statements: acc.statements + current.statements,
      functions: acc.functions + current.functions,
      branches: acc.branches + current.branches,
    }),
    { lines: 0, statements: 0, functions: 0, branches: 0 }
  );

  return {
    lines: totals.lines / projectMetricsList.length,
    statements: totals.statements / projectMetricsList.length,
    functions: totals.functions / projectMetricsList.length,
    branches: totals.branches / projectMetricsList.length,
  };
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function writeSummary(stepSummaryPath: string | null, summaryBody: string): void {
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, summaryBody, 'utf8');
  }
}

function resolveCoveragePaths(rootDir: string): CoveragePaths {
  return {
    rootDir,
    policyPath: path.join(rootDir, 'tooling/testing/coverage-policy.json'),
    baselinePath: path.join(rootDir, 'tooling/testing/coverage-baseline.json'),
    workspaceRoots: ['apps', 'packages'].map((dir) => path.join(rootDir, dir)),
  };
}

function loadCoverageData(rootDir: string): LoadedCoverageData {
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

    acc[projectName] = toMetricValues(readJson<CoverageSummary>(summaryPath));
    return acc;
  }, {});

  const lcovFiles = paths.workspaceRoots.flatMap((dir) => findCoverageArtifacts(dir, 'lcov.info'));
  const fileCoverageByProject = lcovFiles.reduce<Record<string, Record<string, FileCoverageMetrics>>>(
    (acc, lcovPath) => {
      const projectName = projectFromCoveragePath(lcovPath.replace(/lcov\.info$/, 'coverage-summary.json'));
      if (!projectName) {
        return acc;
      }

      acc[projectName] = parseLcovInfo(rootDir, lcovPath);
      return acc;
    },
    {}
  );

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
    const normalizedFilePath = path.relative(rootDir, absoluteFilePath).split(path.sep).join('/');

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

function readLcovCounter(record: string, label: string): number {
  const match = record.match(new RegExp(`^${label}:(\\d+)$`, 'm'));
  return match ? Number(match[1]) : 0;
}

function toPct(hit: number, found: number): number {
  if (found === 0) {
    return 100;
  }

  return Number(((hit / found) * 100).toFixed(2));
}

function evaluateFloors(
  policy: CoveragePolicy,
  projects: Record<string, MetricFloors>,
  requireSummaries: boolean
): GateError[] {
  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const metrics = policy.metrics;
  const errors: GateError[] = [];
  const expectedProjects = Object.keys(policy.perProjectFloors ?? {}).filter(
    (name) => !exemptProjects.has(name)
  );

  if (requireSummaries) {
    const missingSummaryErrors = expectedProjects
      .filter((projectName) => !projects[projectName])
      .map<GateError>((projectName) => ({
        scope: 'project',
        message: `[${projectName}] missing coverage-summary.json`,
      }));
    errors.push(...missingSummaryErrors);
  }

  const activeProjects = Object.entries(projects).filter(([name]) => !exemptProjects.has(name));
  const projectFloorErrors = activeProjects.flatMap(([projectName, values]) => {
    const floorConfig = policy.perProjectFloors?.[projectName] ?? policy.globalFloors;
    const criticalFloors = policy.criticalProjects?.[projectName]?.minimumFloors ?? {};
    return metrics.flatMap((metric) => {
      const floor = Math.max(
        Number(floorConfig[metric] ?? policy.globalFloors[metric] ?? 0),
        Number(criticalFloors[metric] ?? 0)
      );
      const current = Number(values[metric] ?? 0);
      if (current >= floor) {
        return [];
      }

      return [
        {
          scope: 'project' as const,
          message: `[${projectName}] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
        },
      ];
    });
  });
  errors.push(...projectFloorErrors);

  const globalCoverage = mergeGlobal(activeProjects.map(([, values]) => values));
  const globalFloorErrors = metrics.flatMap((metric) => {
    const floor = Number(policy.globalFloors?.[metric] ?? 0);
    const current = Number(globalCoverage[metric] ?? 0);
    if (current >= floor) {
      return [];
    }

    return [
      {
        scope: 'global' as const,
        message: `[global] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
      },
    ];
  });
  errors.push(...globalFloorErrors);

  return errors;
}

function evaluateCriticalHotspots(
  policy: CoveragePolicy,
  projects: Record<string, MetricFloors>,
  fileCoverageByProject: Record<string, Record<string, FileCoverageMetrics>>,
  requireSummaries: boolean
): GateError[] {
  const criticalProjects = policy.criticalProjects ?? {};
  const errors: GateError[] = [];

  for (const [projectName, criticalPolicy] of Object.entries(criticalProjects)) {
    const activeProject = Boolean(projects[projectName]);
    if (!activeProject && !requireSummaries) {
      continue;
    }

    const hotspotFloors = criticalPolicy.hotspotFloors ?? [];
    if (hotspotFloors.length === 0) {
      continue;
    }

    const fileCoverage = fileCoverageByProject[projectName];
    if (!fileCoverage) {
      if (activeProject || requireSummaries) {
        errors.push({
          scope: 'project',
          message: `[${projectName}] missing lcov.info for critical hotspot coverage evaluation`,
        });
      }
      continue;
    }

    for (const hotspot of hotspotFloors) {
      const hotspotCoverage = fileCoverage[hotspot.path];
      if (!hotspotCoverage) {
        errors.push({
          scope: 'project',
          message: `[${projectName}] missing hotspot coverage for ${hotspot.path}`,
        });
        continue;
      }

      for (const metric of ['lines', 'functions', 'branches'] as const) {
        const floor = hotspot.metrics[metric];
        if (floor === undefined) {
          continue;
        }

        const current = Number(hotspotCoverage[metric] ?? 0);
        if (current >= floor) {
          continue;
        }

        errors.push({
          scope: 'project',
          message: `[${projectName}] hotspot ${hotspot.path} ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
        });
      }
    }
  }

  return errors;
}

function evaluateRegressions(
  policy: CoveragePolicy,
  baseline: CoverageBaseline,
  projects: Record<string, MetricFloors>
): GateError[] {
  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const maxAllowedDrop = Number(policy.maxAllowedDropPctPoints ?? 0);
  const metrics = policy.metrics;
  const activeProjects = Object.entries(projects).filter(([name]) => !exemptProjects.has(name));

  return activeProjects.flatMap(([projectName, values]) => {
    const baselineValues = baseline.projects?.[projectName] ?? null;
    if (!baselineValues) {
      return [];
    }

    return metrics.flatMap((metric) => {
      if (typeof baselineValues[metric] !== 'number') {
        return [];
      }

      const drop = Number(baselineValues[metric]) - Number(values[metric] ?? 0);
      if (drop <= maxAllowedDrop) {
        return [];
      }

      return [
        {
          scope: 'project' as const,
          message: `[${projectName}] ${metric} dropped by ${drop.toFixed(2)}pp (allowed ${maxAllowedDrop.toFixed(2)}pp)`,
        },
      ];
    });
  });
}

function generateReport(policy: CoveragePolicy, projects: Record<string, MetricFloors>): string {
  const sortedProjects = Object.entries(projects).sort(([a], [b]) => a.localeCompare(b));
  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const activeProjects = sortedProjects.filter(([name]) => !exemptProjects.has(name));
  const globalCoverage = mergeGlobal(activeProjects.map(([, values]) => values));

  const header = ['## Coverage Summary', '', '| Project | Lines | Statements | Functions | Branches |', '| --- | ---: | ---: | ---: | ---: |'];
  const rows = sortedProjects.map(
    ([projectName, values]) =>
      `| ${projectName} | ${formatPct(values.lines)} | ${formatPct(values.statements)} | ${formatPct(values.functions)} | ${formatPct(values.branches)} |`
  );
  const footer = [
    '',
    `Global coverage (avg): lines ${formatPct(globalCoverage.lines)}, statements ${formatPct(globalCoverage.statements)}, functions ${formatPct(globalCoverage.functions)}, branches ${formatPct(globalCoverage.branches)}`,
  ];

  return [...header, ...rows, ...footer].join('\n') + '\n';
}

export function runCoverageGate(options: RunCoverageGateOptions = {}): RunCoverageGateResult {
  const rootDir = options.rootDir ?? process.cwd();
  const updateBaseline = options.updateBaseline ?? false;
  const requireSummaries = options.requireSummaries ?? false;
  const stepSummaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;

  const loaded = loadCoverageData(rootDir);
  const { paths, policy, baseline, projects, fileCoverageByProject } = loaded;

  if (Object.keys(projects).length === 0) {
    if (requireSummaries) {
      throw new Error('No coverage-summary.json files found. Failing coverage gate because requireSummaries=true.');
    }

    return {
      passed: true,
      updatedBaseline: false,
      summaryBody: '',
      errors: [],
      projects,
    };
  }

  if (updateBaseline) {
    const nextBaseline: CoverageBaseline = { projects };
    fs.writeFileSync(paths.baselinePath, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8');
    return {
      passed: true,
      updatedBaseline: true,
      summaryBody: '',
      errors: [],
      projects,
    };
  }

  const floorErrors = evaluateFloors(policy, projects, requireSummaries);
  const hotspotErrors = evaluateCriticalHotspots(policy, projects, fileCoverageByProject, requireSummaries);
  const regressionErrors = evaluateRegressions(policy, baseline, projects);
  const errors = [...floorErrors, ...hotspotErrors, ...regressionErrors];

  const summaryBody = generateReport(policy, projects);
  writeSummary(stepSummaryPath, summaryBody);

  const sortedErrors = errors
    .sort((a, b) => {
      if (a.scope === b.scope) return a.message.localeCompare(b.message);
      return a.scope === 'global' ? -1 : 1;
    })
    .map((error) => error.message);

  return {
    passed: sortedErrors.length === 0,
    updatedBaseline: false,
    summaryBody,
    errors: sortedErrors,
    projects,
  };
}

export function main(): number {
  const rootDir = process.cwd();
  const updateBaseline = process.argv.includes('--update-baseline');
  const requireSummaries = process.env.COVERAGE_GATE_REQUIRE_SUMMARIES === '1';

  try {
    const result = runCoverageGate({
      rootDir,
      updateBaseline,
      requireSummaries,
      stepSummaryPath: process.env.GITHUB_STEP_SUMMARY ?? null,
    });

    if (result.updatedBaseline) {
      const baselinePath = path.join(rootDir, 'tooling/testing/coverage-baseline.json');
      console.log(colors.green(`✅ Updated baseline at ${baselinePath}`));
      return 0;
    }

    if (!result.summaryBody) {
      console.warn(colors.yellow('⚠️  No coverage-summary.json files found. Skipping coverage gate.'));
      return 0;
    }

    console.log(colors.blue('📊 Coverage summary generated'));
    console.log(result.summaryBody);

    if (!result.passed) {
      console.error(colors.red(`❌ ${colors.bold('Coverage gate failed')}:`));
      for (const error of result.errors) {
        console.error(colors.red(`- ${error}`));
      }
      return 1;
    }

    console.log(colors.green('✅ Coverage gate passed.'));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(colors.red(`❌ ${message}`));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
