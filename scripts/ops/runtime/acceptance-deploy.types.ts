import type {
  AcceptanceDeployOptions,
  AcceptanceDeployReport,
  AcceptanceDeployStep,
  AcceptanceFailureCategory,
  AcceptanceProbeResult,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';

export type MutationContext = {
  mode: 'ci' | 'ci-runner' | 'local-emergency' | 'local-operator';
};

export type JobResult = {
  cleanup: () => Promise<void>;
  durationMs?: number;
  exitCode?: number;
  jobServiceName: string;
  jobStackName: string;
  logTail?: string;
  state: string;
  taskId?: string;
  taskMessage?: string;
};

export type InternalVerifyResult = {
  doctorReport: DoctorReport;
  probes: readonly AcceptanceProbeResult[];
};

export type AcceptanceDeployDeps = {
  assertDeterministicRemoteMutationContext: (
    env: NodeJS.ProcessEnv,
    runtimeProfile: RemoteRuntimeProfile,
    command: 'deploy',
  ) => MutationContext;
  buildInstanceHostnameMappingCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  captureAcceptanceStackStatus: (env: NodeJS.ProcessEnv) => Promise<{ services?: string; tasks?: string }>;
  createBaseAcceptanceDeployReport: (
    runtimeProfile: RemoteRuntimeProfile,
    env: NodeJS.ProcessEnv,
    options: AcceptanceDeployOptions,
    migrationFiles: readonly string[],
  ) => AcceptanceDeployReport;
  createStepResult: (
    name: AcceptanceDeployStep['name'],
    startedAt: number,
    status: AcceptanceDeployStep['status'],
    summary: string,
    details?: Readonly<Record<string, unknown>>,
  ) => AcceptanceDeployStep;
  deployAcceptanceStack: (env: NodeJS.ProcessEnv) => void;
  getGooseConfiguredVersion: () => string;
  jsonOutput: boolean;
  listGooseMigrationFiles: () => readonly string[];
  precheckAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) => Promise<DoctorReport>;
  printJsonIfRequested: (payload: unknown) => void;
  resolveAcceptanceDeployOptions: (env: NodeJS.ProcessEnv, cliOptions: unknown, runtimeProfile: RemoteRuntimeProfile) => AcceptanceDeployOptions;
  runBootstrapJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<JobResult>;
  runExternalSmokeWithWarmup: (env: NodeJS.ProcessEnv, options: { readonly runtimeProfile: RemoteRuntimeProfile }) => Promise<readonly AcceptanceProbeResult[]>;
  runImageSmoke: (env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions, reportId: string) => Promise<readonly AcceptanceProbeResult[]>;
  runInternalVerify: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<InternalVerifyResult>;
  runMigrationJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<JobResult>;
  runSchemaGuard: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  summarizeSchemaGuardFailures: (report: { ok: boolean }) => string;
  waitForPostDeployStabilization: (env: NodeJS.ProcessEnv) => Promise<number>;
  writeAcceptanceDeployReport: (report: AcceptanceDeployReport) => void;
};

export type DeployFailure = {
  category: AcceptanceFailureCategory;
  report: AcceptanceDeployReport;
};

export type AcceptanceDeployState = {
  env: NodeJS.ProcessEnv;
  migrationFiles: readonly string[];
  mutationContext: MutationContext;
  options: AcceptanceDeployOptions;
  report: AcceptanceDeployReport;
  runtimeProfile: RemoteRuntimeProfile;
  steps: AcceptanceDeployStep[];
};
