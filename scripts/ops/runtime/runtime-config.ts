import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions } from '../runtime-env.shared.ts';

type RuntimeConfigDeps = Readonly<{
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  runCapture: (command: string, args: readonly string[]) => string;
}>;

export const shellEscape = (value: string) => /^[A-Za-z0-9_./:=,@+-]+$/.test(value)
  ? value
  : `'${value.replaceAll("'", "'\"'\"'")}'`;

const getGitCommitSha = (deps: RuntimeConfigDeps) => {
  try {
    return deps.runCapture('git', ['rev-parse', 'HEAD']);
  } catch {
    return undefined;
  }
};

const requireEnvValue = (env: NodeJS.ProcessEnv, key: string, errorMessage: string) => {
  const value = env[key]?.trim();
  if (!value) throw new Error(errorMessage);
  return value;
};

const getConfiguredStackName = (env: NodeJS.ProcessEnv) =>
  requireEnvValue(env, 'SVA_STACK_NAME', 'runtime_profile_invalid: SVA_STACK_NAME fehlt fuer den Remote-Betrieb.');

const getConfiguredQuantumEndpoint = (env: NodeJS.ProcessEnv) =>
  env.QUANTUM_ENDPOINT?.trim() ||
  env.PORTAINER_ENDPOINT?.trim() ||
  (() => {
    throw new Error('runtime_profile_invalid: QUANTUM_ENDPOINT fehlt fuer den Remote-Betrieb.');
  })();

const resolveRequiredFlag = (envValue: string | undefined, fallback: boolean) => {
  const explicit = envValue?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return fallback;
};

const isMainserverCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
  resolveRequiredFlag(env.SVA_MAINSERVER_REQUIRED, runtimeProfile !== 'studio');

const isMigrationStatusCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
  resolveRequiredFlag(env.SVA_MIGRATION_STATUS_REQUIRED, runtimeProfile !== 'studio');

const supportedTenantHosts = (env: NodeJS.ProcessEnv) =>
  (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((instanceId) => `${instanceId}.${env.SVA_PARENT_DOMAIN?.trim() || '<missing-parent-domain>'}`);

const getRuntimeContractSummary = (deps: RuntimeConfigDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const isLocal = deps.getRuntimeProfileDefinition(runtimeProfile).isLocal;
  return {
    enableOtel: (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() !== 'false',
    mainserverRequired: isMainserverCheckRequired(runtimeProfile, env),
    parentDomain: env.SVA_PARENT_DOMAIN?.trim() || null,
    publicBaseUrl: env.SVA_PUBLIC_BASE_URL?.trim() || null,
    quantumEndpoint: isLocal ? null : (env.QUANTUM_ENDPOINT?.trim() || null),
    runtimeProfile,
    stackName: isLocal ? null : (env.SVA_STACK_NAME?.trim() || null),
    supportedTenantHosts: supportedTenantHosts(env),
  };
};

const resolveEffectiveImageRefForRemoteChecks = (
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions,
) => {
  const explicitRef = options?.imageRef?.trim() || env.SVA_IMAGE_REF?.trim();
  if (explicitRef) return explicitRef;

  const imageDigest = env.SVA_IMAGE_DIGEST?.trim();
  if (!imageDigest) return undefined;

  const registry = env.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
  const repository = env.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
  return `${registry}/${repository}@${imageDigest}`;
};

const parseContainerEnv = (serialized: string) => {
  const normalized = serialized.trim();
  if (!normalized) return {} as Record<string, string>;

  const parsed = JSON.parse(normalized) as string[];
  return Object.fromEntries(
    parsed
      .filter((entry) => entry.includes('='))
      .map((entry) => {
        const separatorIndex = entry.indexOf('=');
        return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)] as const;
      }),
  );
};

const getRemoteComposeFile = (env: NodeJS.ProcessEnv) =>
  env.SVA_RUNTIME_PROFILE?.trim() === 'studio'
    ? 'deploy/portainer/docker-compose.studio.yml'
    : 'deploy/portainer/docker-compose.yml';

const getRemoteAppServiceName = (env: NodeJS.ProcessEnv) =>
  env.SVA_REMOTE_APP_SERVICE?.trim() || env.SVA_ACCEPTANCE_APP_SERVICE?.trim() || 'app';

export const createRuntimeConfigOps = (deps: RuntimeConfigDeps) => ({
  getConfiguredQuantumEndpoint,
  getConfiguredStackName,
  getGitCommitSha: () => getGitCommitSha(deps),
  getRemoteAppServiceName,
  getRemoteComposeFile,
  getRuntimeContractSummary: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    getRuntimeContractSummary(deps, runtimeProfile, env),
  isMainserverCheckRequired,
  isMigrationStatusCheckRequired,
  parseContainerEnv,
  resolveEffectiveImageRefForRemoteChecks,
  shouldSkipQuantumPrePull: (env: NodeJS.ProcessEnv) => env.SVA_QUANTUM_NO_PRE_PULL?.trim().toLowerCase() === 'true',
}) as const;

export const parseInstanceIdList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const withTemporaryProcessEnv = async <T>(env: NodeJS.ProcessEnv, work: () => Promise<T>): Promise<T> => {
  const previousEnv = { ...process.env };
  Object.assign(process.env, env);

  try {
    return await work();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) delete process.env[key];
    }
    Object.assign(process.env, previousEnv);
  }
};

type CliEnvOverrides = {
  actor?: string;
  grafanaUrl?: string;
  imageDigest?: string;
  imageTag?: string;
  lokiUrl?: string;
  maintenanceWindow?: string;
  releaseMode?: string;
  reportSlug?: string;
  rollbackHint?: string;
  workflow?: string;
};

const applyImageOverrides = (env: NodeJS.ProcessEnv, cliOptions: CliEnvOverrides) => {
  if (cliOptions.imageTag) env.SVA_IMAGE_TAG = cliOptions.imageTag;
  if (!cliOptions.imageDigest) return;

  env.SVA_IMAGE_DIGEST = cliOptions.imageDigest;
  const registry = env.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
  const repository = env.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
  env.SVA_IMAGE_REF = `${registry}/${repository}@${cliOptions.imageDigest}`;
};

export const applyCliOptionEnvOverrides = (env: NodeJS.ProcessEnv, cliOptions: CliEnvOverrides): NodeJS.ProcessEnv => {
  const nextEnv = { ...env };
  applyImageOverrides(nextEnv, cliOptions);
  if (cliOptions.releaseMode) nextEnv.SVA_ACCEPTANCE_RELEASE_MODE = cliOptions.releaseMode;
  if (cliOptions.maintenanceWindow) nextEnv.SVA_ACCEPTANCE_MAINTENANCE_WINDOW = cliOptions.maintenanceWindow;
  if (cliOptions.rollbackHint) nextEnv.SVA_ACCEPTANCE_ROLLBACK_HINT = cliOptions.rollbackHint;
  if (cliOptions.actor) nextEnv.SVA_ACCEPTANCE_DEPLOY_ACTOR = cliOptions.actor;
  if (cliOptions.workflow) nextEnv.SVA_ACCEPTANCE_DEPLOY_WORKFLOW = cliOptions.workflow;
  if (cliOptions.reportSlug) nextEnv.SVA_ACCEPTANCE_REPORT_SLUG = cliOptions.reportSlug;
  if (cliOptions.grafanaUrl) nextEnv.SVA_GRAFANA_URL = cliOptions.grafanaUrl;
  if (cliOptions.lokiUrl) nextEnv.SVA_LOKI_URL = cliOptions.lokiUrl;
  return nextEnv;
};
