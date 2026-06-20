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

export const createTenantSecretRegistryOps = (deps: TenantSecretRegistryDeps) => {
  const loadActiveLocalTenantSecretStates = async (
    env: NodeJS.ProcessEnv,
  ): Promise<readonly LocalTenantSecretState[]> =>
    deps.withTemporaryProcessEnv(env, async () =>
      withRegistryProvisioningWorkerDeps(async (workerDeps) => {
        const instances = await workerDeps.repository.listInstances({ status: 'active' });
        const states: LocalTenantSecretState[] = [];

        for (const instance of instances) {
          const loaded = await loadInstanceWithSecret(workerDeps, instance.instanceId);
          if (!loaded) {
            continue;
          }

          states.push({
            instanceId: loaded.instance.instanceId,
            authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
            authClientSecretReadable: Boolean(loaded.authClientSecret),
            tenantAdminClientConfigured: Boolean(loaded.instance.tenantAdminClient?.clientId),
            tenantAdminClientSecretConfigured: Boolean(loaded.instance.tenantAdminClient?.secretConfigured),
            tenantAdminClientSecretReadable: Boolean(loaded.tenantAdminClientSecret),
          });
        }

        return states;
      }),
    );

  const syncLocalTenantSecretsToRegistry = async (
    env: NodeJS.ProcessEnv,
  ): Promise<LocalTenantSecretSyncSummary> =>
    deps.withTemporaryProcessEnv(env, async () =>
      withRegistryProvisioningWorkerDeps(async (workerDeps) => {
        const before = await loadActiveLocalTenantSecretStates(env);
        const targetInstanceIds = before
          .filter(
            (state) =>
              !state.authClientSecretReadable ||
              !state.authClientSecretConfigured ||
              (state.tenantAdminClientConfigured &&
                (!state.tenantAdminClientSecretConfigured || !state.tenantAdminClientSecretReadable)),
          )
          .map((state) => state.instanceId);

        const healedInstanceIds = new Set<string>();
        const errors: string[] = [];

        for (const instanceId of targetInstanceIds) {
          try {
            const loaded = await loadInstanceWithSecret(workerDeps, instanceId);
            if (!loaded) {
              errors.push(`${instanceId}: instance_not_found`);
              continue;
            }

            await syncProvisionedClientSecretToRegistry(workerDeps, {
              actorId: 'runtime-env-repair',
              loaded,
              requestId: `runtime-env-repair-${Date.now()}`,
            });
            healedInstanceIds.add(instanceId);
          } catch (error) {
            errors.push(`${instanceId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        const after = await loadActiveLocalTenantSecretStates(env);
        const remainingAuthSecretInstanceIds = after
          .filter((state) => !state.authClientSecretConfigured || !state.authClientSecretReadable)
          .map((state) => state.instanceId);
        const remainingTenantAdminSecretInstanceIds = after
          .filter(
            (state) =>
              state.tenantAdminClientConfigured &&
              (!state.tenantAdminClientSecretConfigured || !state.tenantAdminClientSecretReadable),
          )
          .map((state) => state.instanceId);

        return {
          attemptedInstanceIds: targetInstanceIds,
          errors,
          healedInstanceIds: [...healedInstanceIds].sort((left, right) => left.localeCompare(right, 'de')),
          remainingAuthSecretInstanceIds,
          remainingTenantAdminSecretInstanceIds,
        };
      }),
    );

  const loadRegistryTenantTargets = (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: {
      readonly limit?: number;
    },
  ): readonly TenantRuntimeTarget[] => {
    if (!deps.isRemoteRuntimeProfile(runtimeProfile)) {
      return [];
    }

    const limit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(1, Math.floor(options.limit))
        : undefined;
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const sql = `
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

    const payload = deps.parseJsonFromCommandOutput<readonly TenantRuntimeTarget[]>(
      deps.createDbSqlRunner(runtimeProfile, env)(sql),
    );
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.filter(
      (entry): entry is TenantRuntimeTarget =>
        !!entry &&
        typeof entry === 'object' &&
        typeof entry.instanceId === 'string' &&
        typeof entry.host === 'string' &&
        typeof entry.authRealm === 'string',
    );
  };

  return {
    loadActiveLocalTenantSecretStates,
    loadRegistryTenantTargets,
    syncLocalTenantSecretsToRegistry,
  };
};
