export type ModuleClass = 'zentral' | 'kritisch';
export type ComplexityMetricKey =
  'fileLines' | 'functionLines' | 'cyclomaticComplexity' | 'publicExports';

export interface ComplexityThresholds {
  fileLines: number;
  functionLines: number;
  cyclomaticComplexity: number;
  publicExports: number;
}

export interface ComplexityModule {
  id: string;
  label: string;
  class: ModuleClass;
  owner: string;
  reviewCadence: string;
  include: string[];
  exclude?: string[];
  overrides?: Partial<ComplexityThresholds>;
  priority?: number;
}

export interface TrackedFinding {
  ticketId: string;
  ticketSystem: string;
  status: 'planned' | 'open' | 'in_progress' | 'blocked';
  summary: string;
}

export interface ComplexityPolicy {
  version: number;
  classThresholds: Record<ModuleClass, ComplexityThresholds>;
  modules: ComplexityModule[];
  trackedFindings: Record<string, TrackedFinding>;
}

export interface FileComplexityMetrics {
  filePath: string;
  fileLines: number;
  maxFunctionLines: number;
  maxFunctionName: string;
  maxCyclomaticComplexity: number;
  maxComplexityFunctionName: string;
  publicExports: number;
}

export interface ComplexityBaselineEntry {
  moduleId: string;
  filePath: string;
  fileLines: number;
  functionLines: number;
  cyclomaticComplexity: number;
  publicExports: number;
}

export interface ComplexityBaseline {
  files: Record<string, ComplexityBaselineEntry>;
}

export interface ComplexityPaths {
  rootDir: string;
  policyPath: string;
  baselinePath: string;
}

export interface AnalyzedFile {
  module: ComplexityModule;
  metrics: FileComplexityMetrics;
}

export interface MetricViolation {
  findingId: string;
  moduleId: string;
  moduleLabel: string;
  moduleClass: ModuleClass;
  filePath: string;
  metric: ComplexityMetricKey;
  current: number;
  threshold: number;
  trend: number | null;
  trackedFinding: TrackedFinding | null;
}

export interface RunComplexityGateOptions {
  rootDir?: string;
  updateBaseline?: boolean;
  baseRef?: string;
  headRef?: string;
  stepSummaryPath?: string | null;
}

export interface RunComplexityGateResult {
  passed: boolean;
  updatedBaseline: boolean;
  summaryBody: string;
  trackedViolations: MetricViolation[];
  untrackedViolations: MetricViolation[];
  analyzedFiles: AnalyzedFile[];
}
const ALLOWED_TRACKED_FINDING_STATUSES = new Set<TrackedFinding['status']>([
  'planned',
  'open',
  'in_progress',
  'blocked',
]);

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function isComplexityThresholds(input: unknown): input is ComplexityThresholds {
  if (!isRecord(input)) {
    return false;
  }

  return (
    typeof input.fileLines === 'number' &&
    typeof input.functionLines === 'number' &&
    typeof input.cyclomaticComplexity === 'number' &&
    typeof input.publicExports === 'number'
  );
}

function isTrackedFinding(input: unknown): input is TrackedFinding {
  if (!isRecord(input)) {
    return false;
  }

  const status = input.status;
  return (
    typeof input.ticketId === 'string' &&
    typeof input.ticketSystem === 'string' &&
    typeof status === 'string' &&
    ALLOWED_TRACKED_FINDING_STATUSES.has(status as TrackedFinding['status']) &&
    typeof input.summary === 'string'
  );
}

function assertModuleConfig(moduleConfig: unknown): asserts moduleConfig is ComplexityModule {
  if (!isRecord(moduleConfig)) {
    throw new TypeError('Invalid complexity policy: module config must be an object');
  }

  if (
    typeof moduleConfig.id !== 'string' ||
    typeof moduleConfig.label !== 'string' ||
    (moduleConfig.class !== 'zentral' && moduleConfig.class !== 'kritisch') ||
    typeof moduleConfig.owner !== 'string' ||
    typeof moduleConfig.reviewCadence !== 'string'
  ) {
    throw new TypeError('Invalid complexity policy: module config is incomplete');
  }

  if (
    !Array.isArray(moduleConfig.include) ||
    moduleConfig.include.length === 0 ||
    moduleConfig.include.some((pattern) => typeof pattern !== 'string')
  ) {
    throw new TypeError(
      `Invalid complexity policy: module ${moduleConfig.id} include patterns are invalid`
    );
  }

  if (
    moduleConfig.exclude !== undefined &&
    (!Array.isArray(moduleConfig.exclude) ||
      moduleConfig.exclude.some((pattern) => typeof pattern !== 'string'))
  ) {
    throw new TypeError(
      `Invalid complexity policy: module ${moduleConfig.id} exclude patterns are invalid`
    );
  }

  if (
    moduleConfig.overrides !== undefined &&
    (!isRecord(moduleConfig.overrides) ||
      Object.values(moduleConfig.overrides).some(
        (value) => value !== undefined && typeof value !== 'number'
      ))
  ) {
    throw new TypeError(
      `Invalid complexity policy: module ${moduleConfig.id} overrides are invalid`
    );
  }

  if (moduleConfig.priority !== undefined && typeof moduleConfig.priority !== 'number') {
    throw new TypeError(
      `Invalid complexity policy: module ${moduleConfig.id} priority must be a number`
    );
  }
}

export function assertComplexityPolicy(policy: unknown): asserts policy is ComplexityPolicy {
  if (!isRecord(policy)) {
    throw new TypeError('Invalid complexity policy: expected object');
  }

  if (typeof policy.version !== 'number') {
    throw new TypeError('Invalid complexity policy: version must be a number');
  }

  if (
    !isRecord(policy.classThresholds) ||
    !isComplexityThresholds(policy.classThresholds.zentral) ||
    !isComplexityThresholds(policy.classThresholds.kritisch)
  ) {
    throw new TypeError(
      'Invalid complexity policy: classThresholds must define zentral and kritisch'
    );
  }

  if (!Array.isArray(policy.modules) || policy.modules.length === 0) {
    throw new TypeError('Invalid complexity policy: modules must be a non-empty array');
  }

  for (const moduleConfig of policy.modules) {
    assertModuleConfig(moduleConfig);
  }

  if (!isRecord(policy.trackedFindings)) {
    throw new TypeError('Invalid complexity policy: trackedFindings must be an object');
  }

  for (const [findingId, trackedFinding] of Object.entries(policy.trackedFindings)) {
    if (findingId.endsWith(':fileLines')) {
      throw new TypeError(
        `Invalid complexity policy: fileLines findings cannot be tracked (${findingId})`
      );
    }
    if (!isTrackedFinding(trackedFinding)) {
      throw new TypeError(`Invalid complexity policy: trackedFindings.${findingId} is invalid`);
    }
  }
}
