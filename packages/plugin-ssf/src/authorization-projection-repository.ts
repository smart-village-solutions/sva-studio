import type { Pool, PoolClient } from 'pg';

import {
  areSsfAuthorizationProjectionsEqual,
  createSsfAuthorizationRevision,
  normalizeSsfAuthorizationProjection,
  type SsfAuthorizationProjection,
} from './authorization-projection.js';
import {
  mapProjectionRow,
  projectionColumns,
  type ProjectionRow,
} from './authorization-projection-repository-mapping.js';

type ProjectionQueryClient = Pick<Pool, 'query'>;

export type SsfAuthorizationProjectionStatus =
  'pending' | 'projecting' | 'revocation_pending' | 'ready' | 'blocked';

export type SsfAuthorizationProjectionState = Readonly<{
  instanceId: string;
  generation: number;
  status: SsfAuthorizationProjectionStatus;
  desiredRevision: string;
  desiredProjection: SsfAuthorizationProjection;
  confirmedRevision: string | null;
  confirmedProjection: SsfAuthorizationProjection | null;
  sessionsRevokedRevision: string | null;
  lastErrorCode: string | null;
}>;

export const stageSsfAuthorizationProjection = async (
  pool: ProjectionQueryClient,
  projection: SsfAuthorizationProjection
): Promise<SsfAuthorizationProjectionState> => {
  const desiredProjection = normalizeSsfAuthorizationProjection(projection);
  const desiredRevision = createSsfAuthorizationRevision(desiredProjection);
  const result = await pool.query<ProjectionRow>(
    `INSERT INTO ssf.authorization_projections (
       instance_id, desired_revision, desired_projection
     ) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (instance_id) DO UPDATE SET
       generation = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.generation
         ELSE ssf.authorization_projections.generation + 1
       END,
       status = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.status
         ELSE 'pending'
       END,
       desired_revision = EXCLUDED.desired_revision,
       desired_projection = EXCLUDED.desired_projection,
       confirmed_revision = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.confirmed_revision
         ELSE NULL
       END,
       confirmed_projection = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.confirmed_projection
         ELSE NULL
       END,
       sessions_revoked_revision = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.sessions_revoked_revision
         ELSE NULL
       END,
       last_error_code = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.last_error_code
         ELSE NULL
       END,
       confirmed_at = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.confirmed_at
         ELSE NULL
       END,
       sessions_revoked_at = CASE
         WHEN ssf.authorization_projections.desired_revision = EXCLUDED.desired_revision
           THEN ssf.authorization_projections.sessions_revoked_at
         ELSE NULL
       END,
       updated_at = now()
     RETURNING ${projectionColumns}`,
    [desiredProjection.instanceId, desiredRevision, JSON.stringify(desiredProjection)]
  );
  const row = result.rows[0];
  if (!row) throw new Error('ssf_authorization_projection_stage_failed');
  return mapProjectionRow(row);
};

export const claimSsfAuthorizationProjection = async (
  pool: ProjectionQueryClient,
  input: Readonly<{ instanceId: string; generation: number; desiredRevision: string }>
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE ssf.authorization_projections
        SET status = 'projecting', last_error_code = NULL, updated_at = now()
      WHERE instance_id = $1
        AND generation = $2
        AND desired_revision = $3
        AND status IN ('pending', 'projecting', 'revocation_pending', 'blocked')`,
    [input.instanceId, input.generation, input.desiredRevision]
  );
  return result.rowCount === 1;
};

export const confirmSsfAuthorizationProjectionReadBack = async (
  pool: ProjectionQueryClient,
  input: Readonly<{
    desired: SsfAuthorizationProjection;
    readBack: SsfAuthorizationProjection;
    generation: number;
  }>
): Promise<boolean> => {
  const desired = normalizeSsfAuthorizationProjection(input.desired);
  const desiredRevision = createSsfAuthorizationRevision(desired);
  const readBack = normalizeSsfAuthorizationProjection(input.readBack);
  if (!areSsfAuthorizationProjectionsEqual(desired, readBack)) {
    await markSsfAuthorizationProjectionBlocked(pool, {
      instanceId: desired.instanceId,
      generation: input.generation,
      desiredRevision,
      errorCode: 'readback_mismatch',
    });
    return false;
  }

  const result = await pool.query(
    `UPDATE ssf.authorization_projections
        SET status = 'revocation_pending',
            confirmed_revision = $3,
            confirmed_projection = $4::jsonb,
            confirmed_at = now(),
            sessions_revoked_revision = NULL,
            sessions_revoked_at = NULL,
            last_error_code = NULL,
            updated_at = now()
      WHERE instance_id = $1
        AND generation = $2
        AND desired_revision = $3
        AND status = 'projecting'`,
    [desired.instanceId, input.generation, desiredRevision, JSON.stringify(readBack)]
  );
  return result.rowCount === 1;
};

export const markSsfAuthorizationSessionsRevoked = async (
  pool: ProjectionQueryClient,
  input: Readonly<{ instanceId: string; generation: number; authorizationRevision: string }>
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE ssf.authorization_projections
        SET status = 'ready',
            sessions_revoked_revision = $3,
            sessions_revoked_at = now(),
            last_error_code = NULL,
            updated_at = now()
      WHERE instance_id = $1
        AND generation = $2
        AND desired_revision = $3
        AND confirmed_revision = $3
        AND status = 'revocation_pending'`,
    [input.instanceId, input.generation, input.authorizationRevision]
  );
  return result.rowCount === 1;
};

export const markSsfAuthorizationProjectionBlocked = async (
  pool: ProjectionQueryClient,
  input: Readonly<{
    instanceId: string;
    generation: number;
    desiredRevision: string;
    errorCode: string;
  }>
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE ssf.authorization_projections
        SET status = 'blocked', last_error_code = $4, updated_at = now()
      WHERE instance_id = $1
        AND generation = $2
        AND desired_revision = $3
        AND status <> 'ready'`,
    [input.instanceId, input.generation, input.desiredRevision, input.errorCode]
  );
  return result.rowCount === 1;
};

const withTenantRead = async <T>(
  pool: Pool,
  instanceId: string,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original database error.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const readReadySsfAuthorizationRevision = async (
  pool: Pool,
  instanceId: string
): Promise<string | null> =>
  withTenantRead(pool, instanceId, async (client) => {
    const result = await client.query<{ confirmed_revision: string }>(
      `SELECT confirmed_revision
         FROM ssf.authorization_projections
        WHERE instance_id = $1
          AND status = 'ready'
          AND desired_revision = confirmed_revision
          AND confirmed_revision = sessions_revoked_revision
          AND last_error_code IS NULL`,
      [instanceId]
    );
    return result.rows[0]?.confirmed_revision ?? null;
  });
