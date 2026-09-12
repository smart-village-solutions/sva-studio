import {
  prepareInstanceSsfLoginClients,
  readInstanceSsfLoginClientsReady,
  readTenantPermissionProjectionSubjects,
  resolveInstanceKeycloakProjectionTenant,
} from '@sva/auth-runtime/server';
import {
  createConfiguredSsfKeycloakAuthorizationProjectionTarget,
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationProjectionRuntime,
  provisionSsfTenant,
  readSsfTenant,
  readReadySsfAuthorizationRevision,
  resolveSsfDatabasePool,
  resolveSsfRootDatabasePool,
} from '@sva/plugin-ssf/runtime';
import { SSF_LOGIN_CLIENT_ID } from '@sva/plugin-ssf/provisioning';

export const createStudioSsfAuthorizationProjectionTarget = () =>
  createConfiguredSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: (instanceId) =>
      resolveInstanceKeycloakProjectionTenant(instanceId, SSF_LOGIN_CLIENT_ID),
    prepareLoginClients: async (instanceId) => {
      await prepareInstanceSsfLoginClients(instanceId);
    },
    prepareRuntimeBaseline: async (instanceId) => {
      const pool = resolveSsfRootDatabasePool();
      if (!pool) throw new Error('ssf_root_database_not_configured');
      await provisionSsfTenant(pool, instanceId);
    },
    readLoginReadiness: async (instanceId) => {
      const pool = resolveSsfDatabasePool();
      return (
        Boolean(pool && (await readSsfTenant(pool, instanceId))) &&
        (await readInstanceSsfLoginClientsReady(instanceId))
      );
    },
  });

export const createStudioSsfAuthorizationProjectionRuntime = () => {
  const pool = resolveSsfRootDatabasePool();
  if (!pool) {
    return {
      readiness: async () => null,
      reconcile: async (): Promise<never> => {
        throw new Error('ssf_root_database_not_configured');
      },
    };
  }
  return createSsfAuthorizationProjectionRuntime({
    readReadyRevision: async (instanceId) => {
      const runtimePool = resolveSsfDatabasePool();
      return runtimePool ? readReadySsfAuthorizationRevision(runtimePool, instanceId) : null;
    },
    source: { readSubjects: readTenantPermissionProjectionSubjects },
    store: createPostgresSsfAuthorizationProjectionStore(pool),
    target: createStudioSsfAuthorizationProjectionTarget(),
  });
};
