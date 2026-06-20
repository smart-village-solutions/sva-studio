import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions } from '../runtime-env.shared.ts';

type RuntimeConfigDeps = Readonly<{
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => {
    isLocal: boolean;
  };
  runCapture: (command: string, args: readonly string[]) => string;
}>;

export const shellEscape = (value: string) => {
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`;
};

export const createRuntimeConfigOps = (deps: RuntimeConfigDeps) => {
  const getGitCommitSha = () => {
    try {
      return deps.runCapture('git', ['rev-parse', 'HEAD']);
    } catch {
      return undefined;
    }
  };

  const getConfiguredStackName = (env: NodeJS.ProcessEnv) => {
    const stackName = env.SVA_STACK_NAME?.trim();
    if (!stackName) {
      throw new Error('runtime_profile_invalid: SVA_STACK_NAME fehlt fuer den Remote-Betrieb.');
    }

    return stackName;
  };

  const getConfiguredQuantumEndpoint = (env: NodeJS.ProcessEnv) => {
    const endpoint = env.QUANTUM_ENDPOINT?.trim() || env.PORTAINER_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error('runtime_profile_invalid: QUANTUM_ENDPOINT fehlt fuer den Remote-Betrieb.');
    }

    return endpoint;
  };

  const isMainserverCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const explicit = env.SVA_MAINSERVER_REQUIRED?.trim().toLowerCase();
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }

    return runtimeProfile !== 'studio';
  };

  const isMigrationStatusCheckRequired = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const explicit = env.SVA_MIGRATION_STATUS_REQUIRED?.trim().toLowerCase();
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }

    return runtimeProfile !== 'studio';
  };

  const getRuntimeContractSummary = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => ({
    enableOtel: (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() !== 'false',
    mainserverRequired: isMainserverCheckRequired(runtimeProfile, env),
    parentDomain: env.SVA_PARENT_DOMAIN?.trim() || null,
    publicBaseUrl: env.SVA_PUBLIC_BASE_URL?.trim() || null,
    quantumEndpoint: deps.getRuntimeProfileDefinition(runtimeProfile).isLocal ? null : (env.QUANTUM_ENDPOINT?.trim() || null),
    runtimeProfile,
    stackName: deps.getRuntimeProfileDefinition(runtimeProfile).isLocal ? null : (env.SVA_STACK_NAME?.trim() || null),
    supportedTenantHosts: (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((instanceId) => `${instanceId}.${env.SVA_PARENT_DOMAIN?.trim() || '<missing-parent-domain>'}`),
  });

  const resolveEffectiveImageRefForRemoteChecks = (
    env: NodeJS.ProcessEnv,
    options?: AcceptanceDeployOptions,
  ) => {
    const optionImageRef = options?.imageRef?.trim();
    if (optionImageRef) {
      return optionImageRef;
    }

    const configuredImageRef = env.SVA_IMAGE_REF?.trim();
    if (configuredImageRef) {
      return configuredImageRef;
    }

    const imageDigest = env.SVA_IMAGE_DIGEST?.trim();
    if (!imageDigest) {
      return undefined;
    }

    const registry = env.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
    const repository = env.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
    return `${registry}/${repository}@${imageDigest}`;
  };

  const shouldSkipQuantumPrePull = (env: NodeJS.ProcessEnv) =>
    env.SVA_QUANTUM_NO_PRE_PULL?.trim().toLowerCase() === 'true';

  const parseContainerEnv = (serialized: string) => {
    const normalized = serialized.trim();
    if (!normalized) {
      return {} as Record<string, string>;
    }

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

  const getRemoteComposeFile = (env: NodeJS.ProcessEnv) => {
    const runtimeProfile = env.SVA_RUNTIME_PROFILE?.trim();
    if (runtimeProfile === 'studio') {
      return 'deploy/portainer/docker-compose.studio.yml';
    }

    return 'deploy/portainer/docker-compose.yml';
  };

  const getRemoteAppServiceName = (env: NodeJS.ProcessEnv) =>
    env.SVA_REMOTE_APP_SERVICE?.trim() || env.SVA_ACCEPTANCE_APP_SERVICE?.trim() || 'app';

  return {
    getConfiguredQuantumEndpoint,
    getConfiguredStackName,
    getGitCommitSha,
    getRemoteAppServiceName,
    getRemoteComposeFile,
    getRuntimeContractSummary,
    isMainserverCheckRequired,
    isMigrationStatusCheckRequired,
    parseContainerEnv,
    resolveEffectiveImageRefForRemoteChecks,
    shouldSkipQuantumPrePull,
  } as const;
};

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
      if (!(key in previousEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, previousEnv);
  }
};

export const applyCliOptionEnvOverrides = (
  env: NodeJS.ProcessEnv,
  cliOptions: {
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
  },
): NodeJS.ProcessEnv => {
  const nextEnv = { ...env };

  if (cliOptions.imageTag) {
    nextEnv.SVA_IMAGE_TAG = cliOptions.imageTag;
  }

  if (cliOptions.imageDigest) {
    nextEnv.SVA_IMAGE_DIGEST = cliOptions.imageDigest;
    const registry = nextEnv.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
    const repository = nextEnv.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
    nextEnv.SVA_IMAGE_REF = `${registry}/${repository}@${cliOptions.imageDigest}`;
  }

  if (cliOptions.releaseMode) {
    nextEnv.SVA_ACCEPTANCE_RELEASE_MODE = cliOptions.releaseMode;
  }

  if (cliOptions.maintenanceWindow) {
    nextEnv.SVA_ACCEPTANCE_MAINTENANCE_WINDOW = cliOptions.maintenanceWindow;
  }

  if (cliOptions.rollbackHint) {
    nextEnv.SVA_ACCEPTANCE_ROLLBACK_HINT = cliOptions.rollbackHint;
  }

  if (cliOptions.actor) {
    nextEnv.SVA_ACCEPTANCE_DEPLOY_ACTOR = cliOptions.actor;
  }

  if (cliOptions.workflow) {
    nextEnv.SVA_ACCEPTANCE_DEPLOY_WORKFLOW = cliOptions.workflow;
  }

  if (cliOptions.reportSlug) {
    nextEnv.SVA_ACCEPTANCE_REPORT_SLUG = cliOptions.reportSlug;
  }

  if (cliOptions.grafanaUrl) {
    nextEnv.SVA_GRAFANA_URL = cliOptions.grafanaUrl;
  }

  if (cliOptions.lokiUrl) {
    nextEnv.SVA_LOKI_URL = cliOptions.lokiUrl;
  }

  return nextEnv;
};
