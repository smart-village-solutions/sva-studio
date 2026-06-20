import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployOptions,
  AcceptanceDeployReport,
  AcceptanceDeployStep,
  AcceptanceProbeResult,
  AcceptanceReleaseManifest,
  DoctorCheck,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import type { ComposeDocument } from './deploy-project.ts';
import type { RemoteRuntimeConfigDeps, RuntimeContractDeps } from './runtime-deps.types.ts';

export type RemoteStackSnapshot = {
  services: readonly unknown[];
};

export type RemoteStackEvidence = {
  channel: 'docker' | 'portainer-api' | 'quantum-cli';
  hasRunningService: (serviceName: string) => boolean;
  services?: string;
  snapshot?: RemoteStackSnapshot;
  summary: string;
  tasks?: string;
};

export type AcceptanceMaintenanceDeps = Readonly<RemoteRuntimeConfigDeps & RuntimeContractDeps & {
  assertComposeServiceIngressLabels: (compose: ComposeDocument, serviceName: string) => void;
  assertComposeServiceNetworks: (compose: ComposeDocument, serviceName: string, expectedNetworks: readonly string[]) => unknown;
  buildAcceptanceIngressConsistencyCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildAppPrincipalReadinessCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildLocalRuntimeDeployReportPaths: (...args: Parameters<typeof import('../runtime-env.shared.ts').buildAcceptanceReportPaths>) => ReturnType<typeof import('../runtime-env.shared.ts').buildAcceptanceReportPaths>;
  buildQuantumDeployComposeDocument: (compose: ComposeDocument) => unknown;
  checkHttpHealth: (url: string) => Promise<{ payload?: unknown; response: { ok: boolean; status: number } }>;
  commandExists: (commandName: string) => boolean;
  createStepResult: (
    name: AcceptanceDeployStep['name'],
    startedAt: number,
    status: AcceptanceDeployStep['status'],
    summary: string,
    details?: Readonly<Record<string, unknown>>,
  ) => AcceptanceDeployStep;
  deployReportDir: string;
  inspectRemoteServiceContract: (env: NodeJS.ProcessEnv, input: { quantumEndpoint: string; serviceName: string; stackName: string }) => Promise<{ networkNames?: readonly string[] } | null>;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  listGooseMigrationFiles: () => readonly string[];
  parseJsonFromCommandOutput: <T>(value: string) => T;
  readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => Promise<RemoteStackEvidence>;
  rootDir: string;
  run: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
  runBootstrapJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<{ cleanup: () => Promise<void>; jobServiceName: string; jobStackName: string; logTail?: string }>;
  runCapture: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
  runCaptureDetailed: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => { status: number | null; stdout: string };
  runMigrationJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<{ cleanup: () => Promise<void>; jobServiceName: string; jobStackName: string; logTail?: string }>;
  runQuantumExec: (args: readonly string[], env: NodeJS.ProcessEnv, options: { failureMessage: string; marker?: string }) => string;
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  shouldSkipQuantumPrePull: (env: NodeJS.ProcessEnv) => boolean;
  summarizeSchemaGuardFailures: (report: unknown) => string | undefined;
  withoutDebugEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
}>;

export type AcceptanceMaintenanceOps = ReturnType<typeof import('./acceptance-maintenance.ts').createAcceptanceMaintenanceOps>;

export type AcceptanceDeployReportPaths = ReturnType<typeof import('../runtime-env.shared.ts').buildAcceptanceReportPaths>;

export type BaseReportInput = {
  env: NodeJS.ProcessEnv;
  gitCommitSha?: string;
  migrationFiles: readonly string[];
  options: AcceptanceDeployOptions;
  runtimeProfile: RemoteRuntimeProfile;
};

export type ReleaseManifestBuilder = (
  runtimeProfile: RemoteRuntimeProfile,
  options: AcceptanceDeployOptions,
  gitCommitSha?: string,
) => AcceptanceReleaseManifest;
