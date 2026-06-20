import type { RuntimeProfile } from '../../packages/core/src/runtime-profile.ts';

export type RemoteRuntimeProfile = Exclude<RuntimeProfile, 'local-builder' | 'local-keycloak'>;
export type RuntimeCommand =
  | 'deploy'
  | 'doctor'
  | 'down'
  | 'migrate'
  | 'precheck'
  | 'repair'
  | 'reconcile'
  | 'reset'
  | 'smoke'
  | 'status'
  | 'up'
  | 'update'
  | 'verify-schema-snapshot';

export type DoctorCheckStatus = 'error' | 'ok' | 'skipped' | 'warn';
export type DoctorReasonCode =
  | 'actor_binding_drift'
  | 'instance_identity_drift'
  | 'schema_manual_drift'
  | 'schema_migration_drift'
  | 'schema_snapshot_drift'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_admin_client_secret_unreadable'
  | 'tenant_auth_client_secret_missing'
  | 'tenant_auth_client_secret_unreadable'
  | 'worker_unavailable';
export type DoctorRecommendedAction =
  | 'env:bind:local-user'
  | 'env:doctor:local-keycloak'
  | 'env:migrate:local-keycloak'
  | 'env:up:local-keycloak'
  | 'env:reconcile:local-instance-registry'
  | 'env:repair:local-keycloak'
  | 'env:verify:db-schema-snapshot'
  | 'manual_investigation';
export type RuntimeDriftClass = 'actor_binding' | 'instance_identity' | 'schema' | 'schema_snapshot' | 'tenant_secrets' | 'worker';

export type DoctorCheck = {
  code: string;
  details?: Readonly<Record<string, unknown>>;
  driftClass?: RuntimeDriftClass;
  message: string;
  name: string;
  reasonCode?: DoctorReasonCode;
  recommendedAction?: DoctorRecommendedAction;
  repairable?: boolean;
  status: DoctorCheckStatus;
};

export type DoctorReport = {
  checks: readonly DoctorCheck[];
  generatedAt: string;
  profile: RuntimeProfile;
  status: 'error' | 'ok' | 'warn';
};

export type TenantRuntimeTarget = Readonly<{
  authRealm: string;
  host: string;
  instanceId: string;
}>;

export type TenantRuntimeTargetResolution = Readonly<{
  source: 'explicit_env' | 'legacy_allowlist_fallback' | 'local_allowlist' | 'none' | 'registry';
  targets: readonly TenantRuntimeTarget[];
}>;

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

export type GithubArtifactRecord = Readonly<{
  expired?: boolean;
  id?: number;
  name?: string;
  workflow_run?: {
    id?: number;
  };
}>;

export type GithubVerifyArtifactEvidence = Readonly<{
  imageRef: string;
  reportId?: string;
  status: 'ok';
}>;

export type GithubVerifyEvidenceOptions = Readonly<{
  commandExistsImpl?: (commandName: string) => boolean;
  imageTag?: string;
  readArtifactEvidenceImpl?: (args: {
    artifactId?: number;
    artifactName: string;
    imageDigest: string;
    owner: string;
    repo: string;
    runId: number;
  }) => GithubVerifyArtifactEvidence | undefined;
  runCaptureImpl?: (command: string, args: readonly string[]) => string;
}>;
