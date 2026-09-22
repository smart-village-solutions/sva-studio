import type { Pool, PoolClient } from 'pg';

import type {
  SsfAuthorizationProjectionLockedStore,
  SsfAuthorizationProjectionStore,
} from './authorization-projection-reconciler.js';
import {
  claimSsfAuthorizationProjection,
  confirmSsfAuthorizationProjectionReadBack,
  markSsfAuthorizationProjectionBlocked,
  markSsfAuthorizationProjectionReady,
  stageSsfAuthorizationProjection,
} from './authorization-projection-repository.js';

const createLockedProjectionStore = (
  client: PoolClient
): SsfAuthorizationProjectionLockedStore => ({
  stage: (projection) => stageSsfAuthorizationProjection(client, projection),
  claim: (input) => claimSsfAuthorizationProjection(client, input),
  confirmReadBack: (input) => confirmSsfAuthorizationProjectionReadBack(client, input),
  markReady: (input) => markSsfAuthorizationProjectionReady(client, input),
  markBlocked: (input) => markSsfAuthorizationProjectionBlocked(client, input),
});

export const createPostgresSsfAuthorizationProjectionStore = (
  pool: Pool
): SsfAuthorizationProjectionStore => ({
  async withTenantLock<T>(
    instanceId: string,
    operation: (store: SsfAuthorizationProjectionLockedStore) => Promise<T>
  ) {
    const client = await pool.connect();
    let lockAcquired = false;
    let operationFailed = false;
    let primaryError: unknown;
    let unlockFailed = false;
    let unlockError: unknown;
    let result: T | undefined;
    try {
      const lock = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
        [instanceId]
      );
      if (lock.rows[0]?.acquired !== true) {
        throw new Error('ssf_authorization_projection_lock_unavailable');
      }
      lockAcquired = true;
      result = await operation(createLockedProjectionStore(client));
    } catch (error) {
      operationFailed = true;
      primaryError = error;
    } finally {
      try {
        if (lockAcquired) {
          try {
            await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [instanceId]);
          } catch (error) {
            unlockFailed = true;
            unlockError = error;
          }
        }
      } finally {
        client.release();
      }
    }

    if (operationFailed) throw primaryError;
    if (unlockFailed) throw unlockError;
    return result as T;
  },
});
