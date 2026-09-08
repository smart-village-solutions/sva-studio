import {
  readTenantPermissionProjectionSubjects,
  resolveInstanceKeycloakProjectionTenant,
} from '@sva/auth-runtime/server';
import {
  createConfiguredSsfKeycloakAuthorizationProjectionTarget,
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationProjectionRuntime,
  resolveSsfRootDatabasePool,
} from '@sva/plugin-ssf/runtime';
import { SSF_TENANT_OIDC_CLIENT_REQUIREMENT } from '@sva/plugin-ssf/provisioning';

export const createStudioSsfAuthorizationProjectionRuntime = () => {
  const pool = resolveSsfRootDatabasePool();
  if (!pool) {
    return {
      reconcile: async (): Promise<never> => {
        throw new Error('ssf_root_database_not_configured');
      },
    };
  }

  return createSsfAuthorizationProjectionRuntime({
    source: { readSubjects: readTenantPermissionProjectionSubjects },
    store: createPostgresSsfAuthorizationProjectionStore(pool),
    target: createConfiguredSsfKeycloakAuthorizationProjectionTarget({
      resolveTenant: (instanceId) =>
        resolveInstanceKeycloakProjectionTenant(
          instanceId,
          SSF_TENANT_OIDC_CLIENT_REQUIREMENT.clientId
        ),
    }),
  });
};
