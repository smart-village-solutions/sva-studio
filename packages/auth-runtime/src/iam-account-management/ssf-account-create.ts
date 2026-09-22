import {
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationProjection,
  readReadySsfAuthorizationRevision,
  resolveSsfDatabasePool,
  resolveSsfRootDatabasePool,
  SSF_TENANT_PERMISSION_IDS,
} from '@sva/plugin-ssf/runtime';

import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import type { QueryClient } from '../db.js';

const ssfPermissionSet = new Set<string>(SSF_TENANT_PERMISSION_IDS);

export type SsfCreateClaims = Readonly<{
  attributes: Readonly<Record<string, readonly string[]>>;
}>;

const emptySsfCreateClaims: SsfCreateClaims = { attributes: {} };

const readPermissionsForRoles = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly string[]> => {
  if (input.roleIds.length === 0) return [];
  const result = await client.query<{ permission_key: string }>(
    `SELECT DISTINCT p.permission_key
       FROM iam.role_permissions rp
       JOIN iam.permissions p
         ON p.instance_id = rp.instance_id
        AND p.id = rp.permission_id
      WHERE rp.instance_id = $1
        AND rp.role_id = ANY($2::uuid[])
      ORDER BY p.permission_key`,
    [input.instanceId, input.roleIds]
  );
  return result.rows
    .map((row) => row.permission_key)
    .filter((permission) => ssfPermissionSet.has(permission));
};

/**
 * Serializes an SSF account create with the tenant projection. The callback is
 * deliberately supplied by the existing IAM create path so no second account
 * persistence or permission mapping is introduced.
 */
export const withSsfAccountCreate = async <T>(input: {
  instanceId: string;
  execute: (context: {
    readClaims: (input: {
      client: QueryClient;
      keycloakSubject: string;
      roleIds: readonly string[];
      roleNames: readonly string[];
    }) => Promise<SsfCreateClaims>;
  }) => Promise<T>;
}): Promise<T> => {
  const access = await readConfiguredPluginTenantAccess(input.instanceId, 'ssf');
  if (access.reason === 'inactive' || access.reason === 'not_managed') {
    return input.execute({ readClaims: async () => emptySsfCreateClaims });
  }
  if (!access.allowed || access.reason !== 'ready') {
    throw new Error('conflict:SSF-Mandant ist noch nicht bereit.');
  }

  const rootPool = resolveSsfRootDatabasePool();
  const runtimePool = resolveSsfDatabasePool();
  if (!rootPool || !runtimePool) {
    throw new Error('conflict:SSF-Mandant ist noch nicht bereit.');
  }

  return createPostgresSsfAuthorizationProjectionStore(rootPool).withTenantLock(
    input.instanceId,
    async () => {
      const revision = await readReadySsfAuthorizationRevision(runtimePool, input.instanceId);
      if (!revision) throw new Error('conflict:SSF-Mandant ist noch nicht bereit.');
      return input.execute({
        readClaims: async ({ client, keycloakSubject, roleIds, roleNames }) => {
          const permissionIds = await readPermissionsForRoles(client, {
            instanceId: input.instanceId,
            roleIds,
          });
          const projection = createSsfAuthorizationProjection({
            instanceId: input.instanceId,
            subjects: [{ subject: keycloakSubject, roleNames, permissionIds }],
          });
          const subject = projection.subjects[0];
          if (!subject) return emptySsfCreateClaims;
          return {
            attributes: {
              studio_tenant_id: [input.instanceId],
              ssf_roles: subject.roles,
              ssf_permissions: subject.permissions,
              ssf_authorization_revision: [revision],
            },
          };
        },
      });
    }
  );
};
