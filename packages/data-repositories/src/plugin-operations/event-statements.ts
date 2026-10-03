import type { StudioJobEventCreateInput } from '@sva/core';
import type { SqlStatement } from '../iam/repositories/types.js';
import { eventSelectColumns, toJsonSqlValue } from './sql-shared.js';

export const createJobEventStatement = (input: StudioJobEventCreateInput): SqlStatement => ({
  text: `
INSERT INTO iam.studio_job_events (
  id,
  job_id,
  instance_id,
  event_type,
  status,
  progress,
  attempts,
  message,
  details
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb)
RETURNING
${eventSelectColumns}
  `,
  values: [
    input.id,
    input.jobId,
    input.instanceId,
    input.eventType,
    input.status,
    toJsonSqlValue(input.progress),
    input.attempts,
    input.message ?? null,
    toJsonSqlValue(input.details),
  ],
});

export const listJobEventsStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
SELECT
${eventSelectColumns}
FROM iam.studio_job_events
WHERE instance_id = $1
  AND job_id = $2
ORDER BY created_at ASC
  `,
  values: [instanceId, jobId],
});
