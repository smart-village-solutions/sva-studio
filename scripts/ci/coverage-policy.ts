import fs from 'node:fs';

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
  [filePath: string]:
    | {
        lines?: { total?: number; covered?: number; pct?: number };
        statements?: { total?: number; covered?: number; pct?: number };
        functions?: { total?: number; covered?: number; pct?: number };
        branches?: { total?: number; covered?: number; pct?: number };
      }
    | undefined;
}

export interface GateError {
  scope: 'global' | 'project';
  message: string;
}

export interface RunCoverageGateOptions {
  rootDir?: string;
  updateBaseline?: boolean;
  requireSummaries?: boolean;
  evaluateRegressions?: boolean;
  regressionProjectFilter?: readonly string[];
  stepSummaryPath?: string | null;
}

export interface RunCoverageGateResult {
  passed: boolean;
  updatedBaseline: boolean;
  summaryBody: string;
  errors: string[];
  projects: Record<string, MetricFloors>;
}

export interface CoveragePaths {
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

export interface FileCoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
}

export interface LoadedCoverageData {
  paths: CoveragePaths;
  policy: CoveragePolicy;
  baseline: CoverageBaseline;
  projects: Record<string, MetricFloors>;
  fileCoverageByProject: Record<string, Record<string, FileCoverageMetrics>>;
}

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
  const metrics = ['lines', 'functions', 'branches'] as const;
  const allTypesValid = metrics.every((metric) => {
    const value = candidate[metric];
    return value === undefined || typeof value === 'number';
  });

  if (!allTypesValid) {
    return false;
  }

  return metrics.some((metric) => typeof candidate[metric] === 'number');
}

function assertCriticalProjects(criticalProjects: unknown): void {
  if (criticalProjects === undefined) {
    return;
  }
  if (!criticalProjects || typeof criticalProjects !== 'object') {
    throw new TypeError('Invalid coverage policy: criticalProjects must be an object');
  }

  const configs = criticalProjects as Record<string, unknown>;
  for (const [projectName, config] of Object.entries(configs)) {
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

export function assertCoveragePolicy(policy: unknown): asserts policy is CoveragePolicy {
  if (!policy || typeof policy !== 'object') {
    throw new TypeError('Invalid coverage policy: expected object');
  }

  const candidate = policy as Record<string, unknown>;
  const metrics = candidate.metrics;
  const validMetric = new Set<CoverageMetric>(['lines', 'statements', 'functions', 'branches']);

  if (
    !Array.isArray(metrics) ||
    metrics.some((metric) => !validMetric.has(metric as CoverageMetric))
  ) {
    throw new TypeError(
      'Invalid coverage policy: metrics must be an array of coverage metric names'
    );
  }

  if (!isMetricFloors(candidate.globalFloors)) {
    throw new TypeError('Invalid coverage policy: globalFloors must contain numeric metrics');
  }

  if (typeof candidate.maxAllowedDropPctPoints !== 'number') {
    throw new TypeError('Invalid coverage policy: maxAllowedDropPctPoints must be a number');
  }

  if (
    !Array.isArray(candidate.exemptProjects) ||
    candidate.exemptProjects.some((p) => typeof p !== 'string')
  ) {
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

  assertCriticalProjects(candidate.criticalProjects);
}
