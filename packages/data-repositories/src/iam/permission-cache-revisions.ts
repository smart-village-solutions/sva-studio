import type { SqlExecutor, SqlStatement } from './repositories/types.js';

export type PermissionRevisionVector = Readonly<{
  instanceRevision: number;
  userRevision: number;
}>;

export type PermissionRevisionScope =
  | Readonly<{ kind: 'instance'; instanceId: string }>
  | Readonly<{ kind: 'user'; instanceId: string; keycloakSubject: string }>;

export type PermissionCacheRevisionRepository = Readonly<{
  readVector(instanceId: string, keycloakSubject: string): Promise<PermissionRevisionVector>;
  bump(scope: PermissionRevisionScope): Promise<number>;
}>;

type PermissionRevisionVectorRow = Readonly<{
  instance_revision: string | number;
  user_revision: string | number;
}>;

type PermissionRevisionRow = Readonly<{
  revision: string | number;
}>;

const parseRevision = (value: string | number, field: string): number => {
  const revision = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new Error(`invalid_permission_cache_revision:${field}`);
  }
  return revision;
};

export const permissionCacheRevisionStatements = {
  readVector: (instanceId: string, keycloakSubject: string): SqlStatement => ({
    text: `
SELECT
  COALESCE((
    SELECT revision
    FROM iam.permission_cache_instance_revisions
    WHERE instance_id = $1
  ), 1)::text AS instance_revision,
  COALESCE((
    SELECT revision
    FROM iam.permission_cache_user_revisions
    WHERE instance_id = $1
      AND keycloak_subject = $2
  ), 1)::text AS user_revision
`,
    values: [instanceId, keycloakSubject],
  }),
  bumpInstance: (instanceId: string): SqlStatement => ({
    text: `
WITH bumped AS (
  INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision, updated_at)
  VALUES ($1, 2, NOW())
  ON CONFLICT (instance_id) DO UPDATE
    SET revision = iam.permission_cache_instance_revisions.revision + 1,
        updated_at = NOW()
  RETURNING revision
), notified AS (
  SELECT pg_notify(
    'iam_permission_snapshot_invalidation',
    json_build_object(
      'eventId', gen_random_uuid()::text,
      'event', 'PermissionRevisionChanged',
      'instanceId', $1,
      'revisionScope', 'instance',
      'newRevision', revision,
      'trigger', 'pg_notify'
    )::text
  )
  FROM bumped
)
SELECT revision::text AS revision
FROM bumped
CROSS JOIN notified
`,
    values: [instanceId],
  }),
  bumpUser: (instanceId: string, keycloakSubject: string): SqlStatement => ({
    text: `
WITH bumped AS (
  INSERT INTO iam.permission_cache_user_revisions (
    instance_id,
    keycloak_subject,
    revision,
    updated_at
  )
  VALUES ($1, $2, 2, NOW())
  ON CONFLICT (instance_id, keycloak_subject) DO UPDATE
    SET revision = iam.permission_cache_user_revisions.revision + 1,
        updated_at = NOW()
  RETURNING revision
), notified AS (
  SELECT pg_notify(
    'iam_permission_snapshot_invalidation',
    json_build_object(
      'eventId', gen_random_uuid()::text,
      'event', 'PermissionRevisionChanged',
      'instanceId', $1,
      'keycloakSubject', $2,
      'revisionScope', 'user',
      'newRevision', revision,
      'trigger', 'pg_notify'
    )::text
  )
  FROM bumped
)
SELECT revision::text AS revision
FROM bumped
CROSS JOIN notified
`,
    values: [instanceId, keycloakSubject],
  }),
} as const;

const requireSingleRow = <TRow>(rows: readonly TRow[], operation: string): TRow => {
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error(`permission_cache_revision_${operation}_failed`);
  }
  return row;
};

export const createPermissionCacheRevisionRepository = (
  executor: SqlExecutor
): PermissionCacheRevisionRepository => ({
  async readVector(instanceId, keycloakSubject) {
    const result = await executor.execute<PermissionRevisionVectorRow>(
      permissionCacheRevisionStatements.readVector(instanceId, keycloakSubject)
    );
    const row = requireSingleRow(result.rows, 'read');
    return {
      instanceRevision: parseRevision(row.instance_revision, 'instance'),
      userRevision: parseRevision(row.user_revision, 'user'),
    };
  },
  async bump(scope) {
    const statement =
      scope.kind === 'instance'
        ? permissionCacheRevisionStatements.bumpInstance(scope.instanceId)
        : permissionCacheRevisionStatements.bumpUser(scope.instanceId, scope.keycloakSubject);
    const result = await executor.execute<PermissionRevisionRow>(statement);
    const row = requireSingleRow(result.rows, 'bump');
    return parseRevision(row.revision, scope.kind);
  },
});
