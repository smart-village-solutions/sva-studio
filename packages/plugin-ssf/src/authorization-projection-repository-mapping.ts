import { ssfAuthorizationProjectionSchema } from './authorization-projection.js';
import type {
  SsfAuthorizationProjectionState,
  SsfAuthorizationProjectionStatus,
} from './authorization-projection-repository.js';

export type ProjectionRow = Readonly<{
  instance_id: string;
  generation: number | string;
  status: SsfAuthorizationProjectionStatus;
  desired_revision: string;
  desired_projection: unknown;
  confirmed_revision: string | null;
  confirmed_projection: unknown | null;
  sessions_revoked_revision: string | null;
  last_error_code: string | null;
}>;

const parseGeneration = (value: number | string): number => {
  const generation = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    throw new Error('ssf_authorization_projection_invalid_generation');
  }
  return generation;
};

export const mapProjectionRow = (row: ProjectionRow): SsfAuthorizationProjectionState => ({
  instanceId: row.instance_id,
  generation: parseGeneration(row.generation),
  status: row.status,
  desiredRevision: row.desired_revision,
  desiredProjection: ssfAuthorizationProjectionSchema.parse(row.desired_projection),
  confirmedRevision: row.confirmed_revision,
  confirmedProjection:
    row.confirmed_projection === null
      ? null
      : ssfAuthorizationProjectionSchema.parse(row.confirmed_projection),
  sessionsRevokedRevision: row.sessions_revoked_revision,
  lastErrorCode: row.last_error_code,
});

export const projectionColumns = `instance_id, generation, status, desired_revision,
  desired_projection, confirmed_revision, confirmed_projection,
  sessions_revoked_revision, last_error_code`;
