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

export const readPermissionRevisionVectorWithClient = (
  client: QueryClient,
  instanceId: string,
  keycloakSubject: string
): Promise<PermissionRevisionVector> =>
  createPermissionCacheRevisionRepository(createExecutor(client)).readVector(
    instanceId,
    keycloakSubject
  );

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
): Promise<number> =>
  createPermissionCacheRevisionRepository(createExecutor(client)).bump(scope);
