import {
  createPermissionCacheRevisionRepository,
  type PermissionRevisionVector,
  type PermissionRevisionScope,
  type SqlExecutor,
} from '@sva/data-repositories';

import type { QueryClient } from '../db.js';
import { withInstanceScopedDb } from './shared.js';

const createExecutor = (client: QueryClient): SqlExecutor => ({
  async execute(statement) {
    return client.query(statement.text, statement.values);
  },
});

export const readPermissionRevisionVectorWithClient = async (
  client: QueryClient,
  instanceId: string,
  keycloakSubject: string,
  options?: Readonly<{ lockForShare: true }>
): Promise<PermissionRevisionVector> => {
  if (options?.lockForShare) {
    // Materialize the existing implicit revision 1 before locking: absent rows must
    // also conflict with the revision writer's INSERT ... ON CONFLICT UPDATE.
    // Always lock instance before user, and retain both locks until transaction end.
    await client.query(
      `INSERT INTO iam.permission_cache_instance_revisions (instance_id)
VALUES ($1) ON CONFLICT (instance_id) DO NOTHING`,
      [instanceId]
    );
    const instanceLock = await client.query(
      `SELECT revision FROM iam.permission_cache_instance_revisions
WHERE instance_id = $1 FOR SHARE`,
      [instanceId]
    );
    if (instanceLock.rowCount !== 1) throw new Error('permission_instance_revision_lock_missing');
    await client.query(
      `INSERT INTO iam.permission_cache_user_revisions (instance_id, keycloak_subject)
VALUES ($1, $2) ON CONFLICT (instance_id, keycloak_subject) DO NOTHING`,
      [instanceId, keycloakSubject]
    );
    const userLock = await client.query(
      `SELECT revision FROM iam.permission_cache_user_revisions
WHERE instance_id = $1 AND keycloak_subject = $2 FOR SHARE`,
      [instanceId, keycloakSubject]
    );
    if (userLock.rowCount !== 1) throw new Error('permission_user_revision_lock_missing');
  }
  return createPermissionCacheRevisionRepository(createExecutor(client)).readVector(
    instanceId,
    keycloakSubject
  );
};

export const readPermissionRevisionVector = (
  instanceId: string,
  keycloakSubject: string
): Promise<PermissionRevisionVector> =>
  withInstanceScopedDb(instanceId, (client) =>
    readPermissionRevisionVectorWithClient(client, instanceId, keycloakSubject)
  );

export const bumpPermissionRevisionWithClient = (
  client: QueryClient,
  scope: PermissionRevisionScope
): Promise<number> => createPermissionCacheRevisionRepository(createExecutor(client)).bump(scope);
