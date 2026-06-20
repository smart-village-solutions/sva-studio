import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { TenantRuntimeTarget } from '../runtime-env.shared.ts';
import { withRegistryProvisioningWorkerDeps } from '../../../packages/auth-runtime/src/iam-instance-registry/repository.ts';
import { loadInstanceWithSecret } from '../../../packages/auth-runtime/src/iam-instance-registry/service-keycloak.ts';
import { syncProvisionedClientSecretToRegistry } from '../../../packages/auth-runtime/src/iam-instance-registry/service-keycloak-execution-shared.ts';

export type LocalTenantSecretState = Readonly<{
  authClientSecretConfigured: boolean;
  authClientSecretReadable: boolean;
  instanceId: string;
  tenantAdminClientConfigured: boolean;
  tenantAdminClientSecretConfigured: boolean;
  tenantAdminClientSecretReadable: boolean;
}>;

export type LocalTenantSecretSyncSummary = Readonly<{
  attemptedInstanceIds: readonly string[];
  errors: readonly string[];
  healedInstanceIds: readonly string[];
  remainingAuthSecretInstanceIds: readonly string[];
  remainingTenantAdminSecretInstanceIds: readonly string[];
}>;

type TenantSecretRegistryDeps = {
  createDbSqlRunner: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => (sql: string) => string;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => boolean;
  parseJsonFromCommandOutput: <T>(value: string) => T;
  withTemporaryProcessEnv: <T>(env: NodeJS.ProcessEnv, operation: () => Promise<T>) => Promise<T>;
};

type RegistryWorkerDeps = Parameters<Parameters<typeof withRegistryProvisioningWorkerDeps>[0]>[0];
type LoadLocalTenantSecretStateOptions = Readonly<{ skipEnvWrapping?: boolean }>;

const loadActiveLocalTenantSecretStates = async (
  deps: TenantSecretRegistryDeps,
  env: NodeJS.ProcessEnv,
  options?: LoadLocalTenantSecretStateOptions,
): Promise<readonly LocalTenantSecretState[]> => {
  const loadStates = async () =>
    withRegistryProvisioningWorkerDeps(async (workerDeps) => {
      const instances = await workerDeps.repository.listInstances({ status: 'active' });
      const states: LocalTenantSecretState[] = [];

      for (const instance of instances) {
        const loaded = await loadInstanceWithSecret(workerDeps, instance.instanceId);
        if (!loaded) continue;
        states.push({
          authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
          authClientSecretReadable: Boolean(loaded.authClientSecret),
          instanceId: loaded.instance.instanceId,
          tenantAdminClientConfigured: Boolean(loaded.instance.tenantAdminClient?.clientId),
          tenantAdminClientSecretConfigured: Boolean(loaded.instance.tenantAdminClient?.secretConfigured),
          tenantAdminClientSecretReadable: Boolean(loaded.tenantAdminClientSecret),
        });
      }

      return states;
    });

  return options?.skipEnvWrapping ? await loadStates() : await deps.withTemporaryProcessEnv(env, loadStates);
};

const tenantNeedsSecretRepair = (state: LocalTenantSecretState) =>
  !state.authClientSecretReadable ||
  !state.authClientSecretConfigured ||
  (state.tenantAdminClientConfigured &&
    (!state.tenantAdminClientSecretConfigured || !state.tenantAdminClientSecretReadable));

const syncOneTenantSecretToRegistry = async (
  workerDeps: RegistryWorkerDeps,
  instanceId: string,
) => {
  const loaded = await loadInstanceWithSecret(workerDeps, instanceId);
  if (!loaded) return 'instance_not_found';
  await syncProvisionedClientSecretToRegistry(workerDeps, {
    actorId: 'runtime-env-repair',
    loaded,
    requestId: `runtime-env-repair-${instanceId}-${Date.now()}`,
  });
  return undefined;
};

const remainingAuthSecretInstanceIds = (states: readonly LocalTenantSecretState[]) =>
  states
    .filter((state) => !state.authClientSecretConfigured || !state.authClientSecretReadable)
    .map((state) => state.instanceId);

const remainingTenantAdminSecretInstanceIds = (states: readonly LocalTenantSecretState[]) =>
  states
    .filter((state) =>
      state.tenantAdminClientConfigured &&
      (!state.tenantAdminClientSecretConfigured || !state.tenantAdminClientSecretReadable))
    .map((state) => state.instanceId);

const syncLocalTenantSecretsToRegistry = async (
  deps: TenantSecretRegistryDeps,
  env: NodeJS.ProcessEnv,
): Promise<LocalTenantSecretSyncSummary> =>
  deps.withTemporaryProcessEnv(env, async () =>
    withRegistryProvisioningWorkerDeps(async (workerDeps) => {
      const before = await loadActiveLocalTenantSecretStates(deps, env, { skipEnvWrapping: true });
      const targetInstanceIds = before.filter(tenantNeedsSecretRepair).map((state) => state.instanceId);
      const healedInstanceIds = new Set<string>();
      const errors: string[] = [];

      for (const instanceId of targetInstanceIds) {
        try {
          const failure = await syncOneTenantSecretToRegistry(workerDeps, instanceId);
          failure ? errors.push(`${instanceId}: ${failure}`) : healedInstanceIds.add(instanceId);
        } catch (error) {
          errors.push(`${instanceId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const after = await loadActiveLocalTenantSecretStates(deps, env, { skipEnvWrapping: true });
      return {
        attemptedInstanceIds: targetInstanceIds,
        errors,
        healedInstanceIds: [...healedInstanceIds].sort((left, right) => left.localeCompare(right, 'de')),
        remainingAuthSecretInstanceIds: remainingAuthSecretInstanceIds(after),
        remainingTenantAdminSecretInstanceIds: remainingTenantAdminSecretInstanceIds(after),
      };
    }),
  );

const remoteRegistryLimitClause = (options?: { readonly limit?: number }) => {
  const limit =
    typeof options?.limit === 'number' && Number.isFinite(options.limit)
      ? Math.max(1, Math.floor(options.limit))
      : undefined;
  return limit ? `LIMIT ${limit}` : '';
};

const buildRegistryTenantTargetsSql = (limitClause: string) => `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'instanceId', scoped.instance_id,
      'host', scoped.primary_hostname,
      'authRealm', scoped.auth_realm
    )
    ORDER BY scoped.instance_id
  ),
  '[]'::json
)::text
FROM (
  SELECT
    instance.id AS instance_id,
    instance.primary_hostname,
    COALESCE(NULLIF(instance.auth_realm, ''), instance.id) AS auth_realm
  FROM iam.instances instance
  WHERE instance.status = 'active'
    AND NULLIF(instance.primary_hostname, '') IS NOT NULL
  ORDER BY instance.id
  ${limitClause}
) scoped;
`;

const isTenantRuntimeTarget = (entry: unknown): entry is TenantRuntimeTarget =>
  !!entry &&
  typeof entry === 'object' &&
  typeof (entry as TenantRuntimeTarget).instanceId === 'string' &&
  typeof (entry as TenantRuntimeTarget).host === 'string' &&
  typeof (entry as TenantRuntimeTarget).authRealm === 'string';

const loadRegistryTenantTargets = (
  deps: TenantSecretRegistryDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: { readonly limit?: number },
): readonly TenantRuntimeTarget[] => {
  if (!deps.isRemoteRuntimeProfile(runtimeProfile)) return [];
  const sql = buildRegistryTenantTargetsSql(remoteRegistryLimitClause(options));
  const payload = deps.parseJsonFromCommandOutput<readonly TenantRuntimeTarget[]>(
    deps.createDbSqlRunner(runtimeProfile, env)(sql),
  );
  return Array.isArray(payload) ? payload.filter(isTenantRuntimeTarget) : [];
};

export const createTenantSecretRegistryOps = (deps: TenantSecretRegistryDeps) => ({
  loadActiveLocalTenantSecretStates: (env: NodeJS.ProcessEnv) =>
    loadActiveLocalTenantSecretStates(deps, env),
  loadRegistryTenantTargets: (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: { readonly limit?: number },
  ) => loadRegistryTenantTargets(deps, runtimeProfile, env, options),
  syncLocalTenantSecretsToRegistry: (env: NodeJS.ProcessEnv) =>
    syncLocalTenantSecretsToRegistry(deps, env),
});
