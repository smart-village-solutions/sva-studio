import type { RemoteRuntimeProfile } from './runtime-env.shared.runtime.types.ts';

export type AcceptanceReleaseMode = 'app-only' | 'schema-and-app';
export type RemoteMutationCommand = 'deploy' | 'down' | 'migrate' | 'reset';
export type AcceptanceDeployStepName =
  | 'environment-precheck'
  | 'image-smoke'
  | 'migrate'
  | 'bootstrap'
  | 'deploy'
  | 'internal-verify'
  | 'external-smoke'
  | 'release-decision';
export type AcceptanceDeployStepStatus = 'ok' | 'skipped' | 'error';
export type AcceptanceFailureCategory =
  | 'config'
  | 'image'
  | 'migration'
  | 'bootstrap'
  | 'startup'
  | 'health'
  | 'ingress'
  | 'dependency';

export type RuntimeCliOptions = {
  approvalToken?: string;
  actor?: string;
  authoritative?: boolean;
  grafanaUrl?: string;
  imageDigest?: string;
  imageTag?: string;
  jsonOutput: boolean;
  lokiUrl?: string;
  localOverrideFile?: string;
  maintenanceWindow?: string;
  releaseMode?: AcceptanceReleaseMode;
  reportSlug?: string;
  rollbackHint?: string;
  workflow?: string;
};

export type AcceptanceDeployOptions = {
  actor: string;
  grafanaUrl?: string;
  imageDigest: string;
  imageRef: string;
  imageRepository: string;
  imageTag?: string;
  lokiUrl?: string;
  maintenanceWindow?: string;
  monitoringConfigImageTag?: string;
  releaseMode: AcceptanceReleaseMode;
  reportSlug: string;
  rollbackHint: string;
  workflow: string;
};

export type AcceptanceProbeScope = 'external' | 'image-smoke' | 'internal';

export type AcceptanceProbeResult = {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  httpStatus?: number;
  message: string;
  name: string;
  scope: AcceptanceProbeScope;
  status: 'error' | 'ok';
  target: string;
};

export type ProdParityProbePlan = {
  rootHost: string;
  tenantHosts: ReadonlyArray<{
    host: string;
    instanceId: string;
  }>;
};

export type AcceptanceReleaseManifest = {
  actor: string;
  commitSha?: string;
  imageDigest: string;
  imageRef: string;
  imageRepository: string;
  imageTag?: string;
  monitoringConfigImageTag?: string;
  profile: RemoteRuntimeProfile;
  releaseMode: AcceptanceReleaseMode;
  workflow: string;
};

export type AcceptanceDeployStep = {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  finishedAt: string;
  name: AcceptanceDeployStepName;
  startedAt: string;
  status: AcceptanceDeployStepStatus;
  summary: string;
};

export type AcceptanceJobPhaseReport = {
  completedAt?: string;
  details?: Readonly<Record<string, unknown>>;
  errorMessage?: string;
  job?: {
    durationMs?: number;
    exitCode?: number;
    jobServiceName: string;
    jobStackName: string;
    logTail?: string;
    state: string;
    taskId?: string;
    taskMessage?: string;
  };
  startedAt?: string;
  status: 'error' | 'ok' | 'skipped';
};

export type AcceptanceDeployReport = {
  actor: string;
  artifacts: {
    bootstrapJobPath: string;
    bootstrapReportPath: string;
    externalSmokePath: string;
    internalVerifyPath: string;
    jsonPath: string;
    markdownPath: string;
    migrationJobPath: string;
    migrationReportPath: string;
    phaseReportPath: string;
    releaseManifestPath: string;
  };
  bootstrapReport?: AcceptanceJobPhaseReport;
  externalProbes: readonly AcceptanceProbeResult[];
  failureCategory?: AcceptanceFailureCategory;
  generatedAt: string;
  imageDigest: string;
  imageRef: string;
  imageRepository: string;
  imageTag?: string;
  internalProbes: readonly AcceptanceProbeResult[];
  maintenanceWindow?: string;
  migrationFiles: readonly string[];
  migrationReport?: AcceptanceJobPhaseReport;
  observability: {
    grafanaUrl?: string;
    lokiUrl?: string;
    notes: readonly string[];
  };
  profile: RemoteRuntimeProfile;
  releaseDecision: {
    summary: string;
    technicalGatePassed: boolean;
  };
  releaseManifest: AcceptanceReleaseManifest;
  releaseMode: AcceptanceReleaseMode;
  reportId: string;
  rollbackHint: string;
  runtimeContract: {
    derivedKeys: readonly string[];
    effectiveSummary: Readonly<Record<string, unknown>>;
    requiredKeys: readonly string[];
  };
  stackName: string;
  stackStatus?: {
    services?: string;
    tasks?: string;
  };
  status: 'ok' | 'error';
  steps: readonly AcceptanceDeployStep[];
  workflow: string;
};
