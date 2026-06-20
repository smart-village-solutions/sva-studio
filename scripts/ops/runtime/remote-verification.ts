import type {
  RemoteRuntimeProfile,
  RuntimeProfile,
  TenantRuntimeTarget,
  TenantRuntimeTargetResolution,
} from '../runtime-env.shared.ts';
import { createStudioImageVerifyEvidenceReaders } from './studio-image-verify-evidence.ts';

type RemoteVerificationDeps = {
  commandExists: (commandName: string) => boolean;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  loadRegistryTenantTargets: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv, options?: { readonly limit?: number }) => readonly TenantRuntimeTarget[];
  parseInstanceIdList: (value?: string) => readonly string[];
  runCapture: (command: string, args?: readonly string[]) => string;
  runtimeArtifactsDir: string;
  wait: (ms: number) => Promise<unknown>;
};

export const parseTenantRealmOverrides = (rawValue: string | undefined): ReadonlyMap<string, string> => {
  const entries = (rawValue ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0 || separatorIndex === entry.length - 1) return [];

      const instanceId = entry.slice(0, separatorIndex).trim();
      const authRealm = entry.slice(separatorIndex + 1).trim();
      return instanceId.length > 0 && authRealm.length > 0 ? [[instanceId, authRealm] as const] : [];
    });

  return new Map(entries);
};

export const mergeExplicitTenantTargetsWithRegistry = (
  explicitTargets: readonly TenantRuntimeTarget[],
  registryTargets: readonly TenantRuntimeTarget[],
): readonly TenantRuntimeTarget[] => {
  if (explicitTargets.length === 0 || registryTargets.length === 0) return explicitTargets;

  const registryByInstanceId = new Map(registryTargets.map((target) => [target.instanceId, target] as const));
  return explicitTargets.map((target) => {
    const registryTarget = registryByInstanceId.get(target.instanceId);
    return registryTarget ? { ...target, authRealm: registryTarget.authRealm } : target;
  });
};

const buildTenantTargetsFromInstanceIds = (
  instanceIds: readonly string[],
  parentDomain: string | undefined,
  realmOverrides?: ReadonlyMap<string, string>,
): readonly TenantRuntimeTarget[] => {
  if (!parentDomain) return [];

  return instanceIds.map((instanceId) => ({
    authRealm: realmOverrides?.get(instanceId) ?? instanceId,
    host: `${instanceId}.${parentDomain}`,
    instanceId,
  }));
};

const explicitTenantTargets = (deps: RemoteVerificationDeps, env: NodeJS.ProcessEnv) =>
  buildTenantTargetsFromInstanceIds(
    deps.parseInstanceIdList(env.SVA_TENANT_SCOPE_INSTANCE_IDS),
    env.SVA_PARENT_DOMAIN?.trim(),
    parseTenantRealmOverrides(env.SVA_TENANT_REALM_OVERRIDES),
  );

const resolveExplicitTenantRuntimeTargets = (
  deps: RemoteVerificationDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  explicitTargets: readonly TenantRuntimeTarget[],
): TenantRuntimeTargetResolution | null => {
  if (explicitTargets.length === 0) return null;
  if (!deps.isRemoteRuntimeProfile(runtimeProfile)) return { source: 'explicit_env', targets: explicitTargets };

  try {
    const registryTargets = deps.loadRegistryTenantTargets(runtimeProfile, env);
    return {
      source: 'explicit_env',
      targets: mergeExplicitTenantTargetsWithRegistry(explicitTargets, registryTargets),
    };
  } catch {
    return { source: 'explicit_env', targets: explicitTargets };
  }
};

const resolveRegistryTenantRuntimeTargets = (
  deps: RemoteVerificationDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: { readonly limit?: number },
): TenantRuntimeTargetResolution | null => {
  if (!deps.isRemoteRuntimeProfile(runtimeProfile)) return null;
  try {
    const registryTargets = deps.loadRegistryTenantTargets(runtimeProfile, env, options);
    return registryTargets.length > 0 ? { source: 'registry', targets: registryTargets } : null;
  } catch {
    return null;
  }
};

const resolveLegacyTenantRuntimeTargets = (
  deps: RemoteVerificationDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): TenantRuntimeTargetResolution => {
  const legacyTargets = buildTenantTargetsFromInstanceIds(
    deps.parseInstanceIdList(env.SVA_ALLOWED_INSTANCE_IDS),
    env.SVA_PARENT_DOMAIN?.trim(),
    parseTenantRealmOverrides(env.SVA_TENANT_REALM_OVERRIDES),
  );
  if (legacyTargets.length === 0) return { source: 'none', targets: [] };
  return {
    source: deps.isRemoteRuntimeProfile(runtimeProfile) ? 'legacy_allowlist_fallback' : 'local_allowlist',
    targets: legacyTargets,
  };
};

const resolveTenantRuntimeTargets = async (
  deps: RemoteVerificationDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: { readonly limit?: number },
): Promise<TenantRuntimeTargetResolution> =>
  resolveExplicitTenantRuntimeTargets(deps, runtimeProfile, env, explicitTenantTargets(deps, env)) ??
  resolveRegistryTenantRuntimeTargets(deps, runtimeProfile, env, options) ??
  resolveLegacyTenantRuntimeTargets(deps, runtimeProfile, env);

const selectReleaseBlockingTenantTargets = (
  runtimeProfile: RuntimeProfile,
  tenantTargets: readonly TenantRuntimeTarget[],
): readonly TenantRuntimeTarget[] =>
  runtimeProfile === 'studio'
    ? tenantTargets.filter((target) => target.instanceId === 'de-studio-sandbox')
    : tenantTargets;

const shouldUseStudioReleaseBlockingTenantScope = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
  runtimeProfile === 'studio' && (env.SVA_ACCEPTANCE_RELEASE_MODE?.trim().length ?? 0) > 0;

const selectSmokeTenantTargets = (
  runtimeProfile: RuntimeProfile,
  tenantTargets: readonly TenantRuntimeTarget[],
  options: { readonly env: NodeJS.ProcessEnv; readonly source: TenantRuntimeTargetResolution['source'] },
): readonly TenantRuntimeTarget[] => {
  if (!shouldUseStudioReleaseBlockingTenantScope(runtimeProfile, options.env)) return tenantTargets;

  const blockingTargets = selectReleaseBlockingTenantTargets(runtimeProfile, tenantTargets);
  if (blockingTargets.length > 0) return blockingTargets;

  throw new Error(
    `Release-blockierender Tenant de-studio-sandbox fehlt im Scope (${options.source}). ` +
      'Pruefe Instanz-Registry oder Tenant-Scope-Konfiguration.',
  );
};

const waitForPostDeployStabilization = async (
  deps: RemoteVerificationDeps,
  env: NodeJS.ProcessEnv,
  waitFn: (ms: number) => Promise<unknown> = deps.wait,
) => {
  const stabilizationDelayMs = Number(env.SVA_POST_DEPLOY_STABILIZATION_DELAY_MS ?? '5000');
  if (!Number.isFinite(stabilizationDelayMs) || stabilizationDelayMs <= 0) return 0;

  await waitFn(stabilizationDelayMs);
  return stabilizationDelayMs;
};

export const createRuntimeRemoteVerification = (deps: RemoteVerificationDeps) => {
  const studioImageVerifyEvidenceReaders = createStudioImageVerifyEvidenceReaders({
    commandExists: deps.commandExists,
    runCapture: deps.runCapture,
    runtimeArtifactsDir: deps.runtimeArtifactsDir,
  });

  return {
    readStudioImageVerifyEvidence: studioImageVerifyEvidenceReaders.readStudioImageVerifyEvidence,
    resolveTenantRuntimeTargets: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv, options?: { readonly limit?: number }) =>
      resolveTenantRuntimeTargets(deps, runtimeProfile, env, options),
    selectReleaseBlockingTenantTargets,
    selectSmokeTenantTargets,
    shouldUseStudioReleaseBlockingTenantScope,
    tryReadGithubStudioImageVerifyEvidence: studioImageVerifyEvidenceReaders.tryReadGithubStudioImageVerifyEvidence,
    waitForPostDeployStabilization: (env: NodeJS.ProcessEnv, waitFn?: (ms: number) => Promise<unknown>) =>
      waitForPostDeployStabilization(deps, env, waitFn),
  } as const;
};
