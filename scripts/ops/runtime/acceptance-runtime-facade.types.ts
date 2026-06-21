import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions, AcceptanceDeployReport, AcceptanceDeployStep, AcceptanceProbeResult, DoctorCheck, RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import type { ComposeDocument, ServiceContract } from './deploy-project.ts';
import type { RemoteServiceContract } from './remote-service-spec.ts';
import type { RemoteRuntimeConfigDeps, RuntimeCommandProcessDeps, RuntimeContractDeps } from './runtime-deps.types.ts';

type AcceptanceRemoteStateOps = {
  acceptanceRemoteStateOps: {
    readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => Promise<{ channel: 'docker' | 'portainer-api' | 'quantum-cli'; hasRunningService: (serviceName: string) => boolean; summary: string }>;
    runBootstrapJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<{ cleanup: () => Promise<void>; durationMs?: number; exitCode?: number; jobServiceName: string; jobStackName: string; logTail?: string; state: string; taskId?: string; taskMessage?: string }>;
    runMigrationJobAgainstAcceptance: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, reportId: string) => Promise<{ cleanup: () => Promise<void>; durationMs?: number; exitCode?: number; jobServiceName: string; jobStackName: string; logTail?: string; state: string; taskId?: string; taskMessage?: string }>;
  };
};

type AcceptanceRuntimeSharedDeps = Readonly<RemoteRuntimeConfigDeps & RuntimeCommandProcessDeps & RuntimeContractDeps & AcceptanceRemoteStateOps & {
  assertComposeServiceIngressLabels: (compose: ComposeDocument, serviceName: string) => void;
  assertComposeServiceNetworks: (compose: ComposeDocument, serviceName: string, expectedNetworks: readonly string[]) => ServiceContract;
  assertDeterministicRemoteMutationContext: (env: NodeJS.ProcessEnv, runtimeProfile: RemoteRuntimeProfile, command: 'deploy') => { mode: 'ci' | 'ci-runner' | 'local-emergency' | 'local-operator' };
  buildAcceptanceReportPaths: typeof import('../runtime-env.shared.ts').buildAcceptanceReportPaths;
  buildInstanceHostnameMappingCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildProdParityProbePlan: typeof import('../runtime-env.shared.ts').buildProdParityProbePlan;
  buildQuantumDeployComposeDocument: (compose: ComposeDocument) => unknown;
  buildTrustedForwardedHeaders: typeof import('../runtime-env.shared.ts').buildTrustedForwardedHeaders;
  captureAcceptanceStackStatus?: never;
  checkHttpHealth: (url: string) => Promise<{ payload?: unknown; response: { ok: boolean; status: number } }>;
  cliOptions: unknown;
  commandExists: (commandName: string) => boolean;
  createProbeResult: (input: {
    details?: Readonly<Record<string, unknown>>;
    durationMs: number;
    httpStatus?: number;
    message: string;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    status: AcceptanceProbeResult['status'];
    target: string;
  }) => AcceptanceProbeResult;
  createStepResult: (name: AcceptanceDeployStep['name'], startedAt: number, status: AcceptanceDeployStep['status'], summary: string, details?: Readonly<Record<string, unknown>>) => AcceptanceDeployStep;
  createStudioImageVerifyEvidenceCheck?: never;
  deployReportDir: string;
  ensureDirs: () => void;
  hasLocalEmergencyRemoteMutationOverride: (env: NodeJS.ProcessEnv) => boolean;
  inspectRemoteServiceContract: (env: NodeJS.ProcessEnv, input: { quantumEndpoint: string; serviceName: string; stackName: string }) => Promise<RemoteServiceContract | null>;
  isExpectedOidcRedirect: (location: string, env: NodeJS.ProcessEnv) => boolean;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  jsonOutput: boolean;
  listGooseMigrationFiles: () => readonly string[];
  parseJsonFromCommandOutput: <T>(output: string) => T;
  parseRuntimeProfile: (value: string | undefined) => RuntimeProfile | undefined;
  printJsonIfRequested: (payload: unknown) => void;
  resolveAcceptanceDeployOptions: (env: NodeJS.ProcessEnv, cliOptions: unknown, runtimeProfile: RemoteRuntimeProfile) => AcceptanceDeployOptions;
  runSchemaGuard: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  shouldSkipQuantumPrePull: (env: NodeJS.ProcessEnv) => boolean;
  summarizeProcessOutput: (result: { stdout?: string; stderr?: string; status?: number | null }) => string;
  summarizeSchemaGuardFailures: (report: SchemaGuardReport) => string | undefined;
  toDoctorCheck: (name: string, status: DoctorCheck['status'], code: string, message: string, details?: Readonly<Record<string, unknown>>) => DoctorCheck;
  wait: (ms: number) => Promise<unknown>;
  withoutDebugEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
}>;

export type AcceptanceRuntimeCoreDeps = AcceptanceRuntimeSharedDeps;

export type AcceptanceDeployFacadeDeps = AcceptanceRuntimeSharedDeps & {
  createBaseAcceptanceDeployReport: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions, migrationFiles: readonly string[]) => AcceptanceDeployReport;
  getGitCommitSha: () => string | undefined;
  precheckAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) => Promise<import('../runtime-env.shared.ts').DoctorReport>;
  runExternalSmokeWithWarmup: (env: NodeJS.ProcessEnv, options: { readonly runtimeProfile: RemoteRuntimeProfile }) => Promise<readonly AcceptanceProbeResult[]>;
  runImageSmoke: (env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions, reportId: string) => Promise<readonly AcceptanceProbeResult[]>;
  runInternalVerify: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<{ doctorReport: import('../runtime-env.shared.ts').DoctorReport; probes: readonly AcceptanceProbeResult[] }>;
  waitForPostDeployStabilization: (env: NodeJS.ProcessEnv) => Promise<number>;
  writeAcceptanceDeployReport: (report: AcceptanceDeployReport) => void;
};
