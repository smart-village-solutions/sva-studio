import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceProbeResult,
  DoctorCheck,
  RemoteRuntimeProfile,
  TenantRuntimeTargetResolution,
} from '../runtime-env.shared.ts';
import type { RemoteServiceContract } from './remote-service-spec.ts';

export type HttpHealthResult = {
  payload?: unknown;
  response: {
    ok: boolean;
    status: number;
  };
};

export type LiveRuntimeFlags = {
  ENABLE_OTEL: string;
  SVA_ENABLE_SERVER_CONSOLE_LOGS: string;
  SVA_RUNTIME_PROFILE: string;
};

export type RemoteStackEvidence = {
  channel: 'docker' | 'portainer-api' | 'quantum-cli';
  hasRunningService: (serviceName: string) => boolean;
  summary: string;
};

export type OidcClientSecretProbe = Readonly<{
  allowClientAuthOnly?: boolean;
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  name: string;
}>;

export type OidcClientSecretProbeResult = Readonly<{
  mode: 'authenticated' | 'skipped';
  name: string;
  reason?: string;
  status: 'ok' | 'skipped';
}>;

export type OidcClientSecretProbePayload = Readonly<{
  access_token?: unknown;
  error?: unknown;
  error_description?: unknown;
}>;

export type RuntimeHealthDeps = {
  assertRuntimeEnv: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => void;
  checkHttpHealth: (url: string) => Promise<HttpHealthResult>;
  commandExists: (commandName: string) => boolean;
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  getRemoteAppServiceName: (env: NodeJS.ProcessEnv) => string;
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  inspectRemoteServiceContract: (
    env: NodeJS.ProcessEnv,
    input: { quantumEndpoint: string; serviceName: string; stackName: string },
  ) => Promise<RemoteServiceContract | null>;
  isExpectedOidcRedirect: (location: string, env: NodeJS.ProcessEnv) => boolean;
  isMainserverCheckRequired: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => boolean;
  isMockAuthRuntimeProfile: (runtimeProfile: RuntimeProfile) => boolean;
  readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => Promise<RemoteStackEvidence>;
  resolveTenantRuntimeTargets: (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: { readonly limit?: number },
  ) => Promise<TenantRuntimeTargetResolution>;
  runCapture: (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => string;
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  summarizeSchemaGuardFailures: (report: unknown) => string | undefined;
  toDoctorCheck: (
    name: string,
    status: DoctorCheck['status'],
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) => DoctorCheck;
  wait: (ms: number) => Promise<unknown>;
  waitForRemoteSmokeWarmup: (
    env: NodeJS.ProcessEnv,
    options?: {
      readonly maxAttempts?: number;
      readonly retryDelayMs?: number;
      readonly runtimeProfile?: RuntimeProfile;
      readonly runner?: (env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>;
    },
  ) => Promise<readonly AcceptanceProbeResult[]>;
  withoutDebugEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
};
