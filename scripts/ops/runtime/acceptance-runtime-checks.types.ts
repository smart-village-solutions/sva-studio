import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions, AcceptanceProbeResult, DoctorCheck } from '../runtime-env.shared.ts';
import type { ComposeDocument } from './deploy-project.ts';
import type { RemoteServiceContract } from './remote-service-spec.ts';

export type HttpHealthResult = {
  payload?: unknown;
  response: {
    ok: boolean;
    status: number;
  };
};

export type ExpectedAppContract = {
  labels: Readonly<Record<string, string>>;
  networks: readonly string[];
};

export type RemoteStackEvidence = {
  channel: 'docker' | 'portainer-api' | 'quantum-cli';
  hasRunningService: (serviceName: string) => boolean;
  summary: string;
};

export type ToDoctorCheck = (
  name: string,
  status: DoctorCheck['status'],
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DoctorCheck;

export type AcceptanceRuntimeCheckDeps = {
  assertComposeServiceIngressLabels: (compose: ComposeDocument, serviceName: string) => void;
  assertComposeServiceNetworks: (
    compose: ComposeDocument,
    serviceName: string,
    expectedNetworks: readonly string[],
  ) => ExpectedAppContract;
  checkHttpHealth: (url: string) => Promise<HttpHealthResult>;
  getConfiguredQuantumEndpoint: (env: NodeJS.ProcessEnv) => string;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  getRemoteAppServiceName: (env: NodeJS.ProcessEnv) => string;
  getRuntimeContractSummary: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Readonly<Record<string, unknown>>;
  getRuntimeProfileDerivedEnvKeys: (runtimeProfile: RuntimeProfile) => readonly string[];
  getRuntimeProfileRequiredEnvKeys: (runtimeProfile: RuntimeProfile) => readonly string[];
  inspectRemoteServiceContract: (
    env: NodeJS.ProcessEnv,
    input: {
      quantumEndpoint: string;
      serviceName: string;
      stackName: string;
    },
  ) => Promise<RemoteServiceContract | null>;
  readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => Promise<RemoteStackEvidence>;
  renderRemoteComposeDocument: (env: NodeJS.ProcessEnv) => ComposeDocument;
  resolveLiveImageFallback: (env: NodeJS.ProcessEnv, input: { stackName: string }) => Promise<string>;
  toDoctorCheck: ToDoctorCheck;
};

export const runtimeContractComparisonKeys = [
  'SVA_RUNTIME_PROFILE',
  'SVA_PUBLIC_BASE_URL',
  'SVA_PARENT_DOMAIN',
  'SVA_ALLOWED_INSTANCE_IDS',
  'APP_DB_USER',
  'POSTGRES_DB',
  'KEYCLOAK_ADMIN_BASE_URL',
  'KEYCLOAK_ADMIN_REALM',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'IAM_UI_ENABLED',
  'IAM_ADMIN_ENABLED',
  'IAM_BULK_ENABLED',
  'VITE_IAM_UI_ENABLED',
  'VITE_IAM_ADMIN_ENABLED',
  'VITE_IAM_BULK_ENABLED',
] as const;

export const runtimeContractSecretPresenceKeys = [
  'SVA_AUTH_CLIENT_SECRET',
  'SVA_AUTH_STATE_SECRET',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'IAM_PII_KEYRING_JSON',
  'APP_DB_PASSWORD',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
] as const;

export type RunHttpProbeInput = {
  expect: (response: Response, payload: unknown) => string | null;
  headers?: HeadersInit;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  target: string;
};
