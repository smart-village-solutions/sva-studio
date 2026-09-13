import {
  prepareInstanceSsfLoginClients,
  readInstanceSsfLoginClientsReady,
  readInstanceSsfProvisioningLoginClientsReady,
  readTenantPermissionProjectionSubjects,
  resolveInstanceKeycloakProjectionTenant,
} from '@sva/auth-runtime/server';
import { loadInstanceById } from '@sva/data-repositories/server';
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

/** Constant-cost readiness for request paths; full subject read-back stays in reconciliation. */
export const readStudioSsfLoginBaselineReadiness = async (
  instanceId: string,
  authRealm?: string
): Promise<boolean> => {
  const pool = resolveSsfDatabasePool();
  return (
    Boolean(pool && (await readSsfTenant(pool, instanceId))) &&
    (await readInstanceSsfLoginClientsReady(instanceId, authRealm))
  );
};

const readStudioSsfProvisioningLoginBaselineReadiness = async (
  instanceId: string,
  authRealm?: string
): Promise<boolean> => {
  const pool = resolveSsfDatabasePool();
  return (
    Boolean(pool && (await readSsfTenant(pool, instanceId))) &&
    (await readInstanceSsfProvisioningLoginClientsReady(instanceId, authRealm))
  );
};

export const createStudioSsfAuthorizationProjectionTarget = (authRealm?: string) =>
  createConfiguredSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: (instanceId) =>
      resolveInstanceKeycloakProjectionTenant(instanceId, SSF_LOGIN_CLIENT_ID, authRealm),
    prepareLoginClients: async (instanceId) => {
      await prepareInstanceSsfLoginClients(instanceId, authRealm);
    },
    prepareRuntimeBaseline: async (instanceId) => {
      const pool = resolveSsfRootDatabasePool();
      if (!pool) throw new Error('ssf_root_database_not_configured');
      await provisionSsfTenant(pool, instanceId);
    },
    readLoginReadiness: (instanceId) =>
      readStudioSsfProvisioningLoginBaselineReadiness(instanceId, authRealm),
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
    createTarget: async (instanceId) => {
      const instance = await loadInstanceById(instanceId);
      if (!instance) throw new Error('ssf_projection_tenant_not_found');
      return createStudioSsfAuthorizationProjectionTarget(instance.authRealm);
    },
  });
};
