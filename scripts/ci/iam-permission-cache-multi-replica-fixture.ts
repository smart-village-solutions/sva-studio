import type { PermissionCacheMultiReplicaConfig } from './iam-permission-cache-multi-replica.ts';

export type QueryResult<TRow = Record<string, unknown>> = {
  readonly rowCount: number | null;
  readonly rows: TRow[];
};

export type PoolClient = {
  query: <TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<QueryResult<TRow>>;
  release: () => void;
};

export type Pool = {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
  query: PoolClient['query'];
};

export type RedisClient = {
  del: (...keys: string[]) => Promise<number>;
  disconnect: () => void;
  scan: (
    cursor: string,
    ...args: readonly (string | number)[]
  ) => Promise<[cursor: string, keys: string[]]>;
};

const TEST_ACCOUNT_ID = '93100000-0000-4000-8000-000000000001';
const TEST_ROLE_ID = '93100000-0000-4000-8000-000000000002';
const TEST_PERMISSION_ID = '93100000-0000-4000-8000-000000000003';

export const withTransaction = async <T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  options?: { readonly rollback?: boolean }
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query(options?.rollback ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const removeRedisSnapshots = async (
  redis: RedisClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
): Promise<void> => {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `perm:v2:${input.instanceId}:${input.keycloakSubject}:*`,
      'COUNT',
      100
    );
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
};

export const cleanupTestData = async (
  pool: Pool,
  redis: RedisClient,
  config: PermissionCacheMultiReplicaConfig
): Promise<void> => {
  await pool.query('DELETE FROM iam.accounts WHERE id = $1', [TEST_ACCOUNT_ID]);
  await pool.query('DELETE FROM iam.permissions WHERE id = $1', [TEST_PERMISSION_ID]);
  await pool.query('DELETE FROM iam.roles WHERE id = $1', [TEST_ROLE_ID]);
  await pool.query(
    'DELETE FROM iam.permission_cache_user_revisions WHERE instance_id = $1 AND keycloak_subject = $2',
    [config.instanceId, config.keycloakSubject]
  );
  await removeRedisSnapshots(redis, config);
};

export const seedTestData = async (
  pool: Pool,
  redis: RedisClient,
  config: PermissionCacheMultiReplicaConfig
): Promise<void> => {
  await cleanupTestData(pool, redis, config);
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO iam.accounts (id, keycloak_subject, status, instance_id)
       VALUES ($1, $2, 'active', $3)`,
      [TEST_ACCOUNT_ID, config.keycloakSubject, config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
       VALUES ($1, $2, 'member')`,
      [config.instanceId, TEST_ACCOUNT_ID]
    );
    await client.query(
      `INSERT INTO iam.roles (
         id, role_name, role_key, display_name, external_role_name, is_system_role,
         role_level, managed_by, sync_state, instance_id
       ) VALUES ($1, 'Permission cache acceptance', 'permission_cache_acceptance',
         'Permission cache acceptance', 'permission_cache_acceptance', false, 10,
         'studio', 'synced', $2)`,
      [TEST_ROLE_ID, config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.permissions (
         id, permission_key, action, resource_type, scope, instance_id
       ) VALUES ($1, $2, $2, $3, '{}'::jsonb, $4)`,
      [TEST_PERMISSION_ID, 'content.cacheProbe', 'acceptance', config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.account_roles (instance_id, account_id, role_id)
       VALUES ($1, $2, $3)`,
      [config.instanceId, TEST_ACCOUNT_ID, TEST_ROLE_ID]
    );
  });
};

type RevisionScope = 'instance' | 'user';

const queryRevision = async (
  client: PoolClient,
  config: PermissionCacheMultiReplicaConfig,
  scope: RevisionScope
): Promise<QueryResult<{ revision: string }>> => {
  if (scope === 'instance') {
    return client.query<{ revision: string }>(
      `INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision, updated_at)
       VALUES ($1, 2, NOW())
       ON CONFLICT (instance_id) DO UPDATE
         SET revision = iam.permission_cache_instance_revisions.revision + 1,
             updated_at = NOW()
       RETURNING revision::text AS revision`,
      [config.instanceId]
    );
  }
  return client.query<{ revision: string }>(
    `INSERT INTO iam.permission_cache_user_revisions (
       instance_id, keycloak_subject, revision, updated_at
     ) VALUES ($1, $2, 2, NOW())
     ON CONFLICT (instance_id, keycloak_subject) DO UPDATE
       SET revision = iam.permission_cache_user_revisions.revision + 1,
           updated_at = NOW()
     RETURNING revision::text AS revision`,
    [config.instanceId, config.keycloakSubject]
  );
};

const notifyRevision = async (
  client: PoolClient,
  config: PermissionCacheMultiReplicaConfig,
  scope: RevisionScope,
  revision: number
): Promise<void> => {
  await client.query('SELECT pg_notify($1, $2)', [
    'iam_permission_snapshot_invalidation',
    JSON.stringify({
      eventId: `local-acceptance-${scope}-${revision}`,
      event: 'PermissionRevisionChanged',
      instanceId: config.instanceId,
      ...(scope === 'user' ? { keycloakSubject: config.keycloakSubject } : {}),
      revisionScope: scope,
      newRevision: revision,
      trigger: 'pg_notify',
    }),
  ]);
};

export const bumpRevision = async (
  client: PoolClient,
  config: PermissionCacheMultiReplicaConfig,
  scope: RevisionScope,
  notify: boolean
): Promise<number> => {
  const result = await queryRevision(client, config, scope);
  const revision = Number(result.rows[0]?.revision);
  if (!Number.isSafeInteger(revision)) {
    throw new Error(`invalid_${scope}_revision`);
  }

  if (notify) {
    await notifyRevision(client, config, scope, revision);
  }
  return revision;
};

export const setPermissionGrant = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig,
  input: {
    readonly granted: boolean;
    readonly notify: boolean;
    readonly revisionScope: 'instance' | 'user';
    readonly rollback?: boolean;
  }
): Promise<number> =>
  withTransaction(
    pool,
    async (client) => {
      if (input.granted) {
        await client.query(
          `INSERT INTO iam.role_permissions (
             instance_id, role_id, permission_id, grant_origin_kind, access_scope
           ) VALUES ($1, $2, $3, 'manual', 'all')
           ON CONFLICT DO NOTHING`,
          [config.instanceId, TEST_ROLE_ID, TEST_PERMISSION_ID]
        );
      } else {
        await client.query(
          `DELETE FROM iam.role_permissions
           WHERE instance_id = $1 AND role_id = $2 AND permission_id = $3`,
          [config.instanceId, TEST_ROLE_ID, TEST_PERMISSION_ID]
        );
      }
      return bumpRevision(client, config, input.revisionScope, input.notify);
    },
    { rollback: input.rollback }
  );
