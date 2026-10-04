import type { StudioJobCreateInput } from '@sva/core';
import type { SqlStatement } from '../iam/repositories/types.js';
import { jobSelectColumns, toJsonSqlValue } from './sql-shared.js';

const createJobSql = `
INSERT INTO iam.studio_jobs (
  id,
  instance_id,
  source,
  plugin_id,
  job_type_id,
  import_profile_id,
  queue_name,
  status,
  progress,
  input_payload,
  result_payload,
  error_payload,
  attempts,
  max_attempts,
  idempotency_key,
  request_id,
  actor_account_id,
  worker_id,
  heartbeat_at,
  last_progress_at,
  cancel_requested_at,
  correlation_id,
  parent_job_id,
  scheduled_at
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9::jsonb,
  $10::jsonb,
  NULL,
  NULL,
  $11,
  $12,
  $13,
  $14,
  $15,
  $16,
  $17,
  $18,
  $19,
  $20,
  $21,
  $22
)
RETURNING
${jobSelectColumns}
  `;

export const createJobStatement = (input: StudioJobCreateInput): SqlStatement => ({
  text: createJobSql,
  values: [
    input.id,
    input.instanceId,
    input.source,
    input.pluginId ?? null,
    input.jobTypeId,
    input.importProfileId ?? null,
    input.queueName,
    input.status,
    toJsonSqlValue(input.progress),
    JSON.stringify(input.inputPayload),
    input.attempts,
    input.maxAttempts,
    input.idempotencyKey,
    input.requestId ?? null,
    input.actorAccountId ?? null,
    input.workerId ?? null,
    input.heartbeatAt ?? null,
    input.lastProgressAt ?? null,
    input.cancelRequestedAt ?? null,
    input.correlationId ?? null,
    input.parentJobId ?? null,
    input.scheduledAt,
  ],
});

export const getJobByIdStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
SELECT
${jobSelectColumns}
FROM iam.studio_jobs
WHERE instance_id = $1
  AND id = $2
  `,
  values: [instanceId, jobId],
});

export const deleteJobStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
WITH deleted_events AS (
  DELETE FROM iam.studio_job_events
  WHERE instance_id = $1
    AND job_id = $2
)
DELETE FROM iam.studio_jobs
WHERE instance_id = $1
  AND id = $2
RETURNING
  id,
  instance_id,
  source,
  plugin_id,
  job_type_id,
  import_profile_id,
  queue_name,
  status,
  progress,
  input_payload,
  result_payload,
  error_payload,
  attempts,
  max_attempts,
  idempotency_key,
  request_id,
  actor_account_id,
  worker_id,
  heartbeat_at,
  last_progress_at,
  cancel_requested_at,
  correlation_id,
  parent_job_id,
  scheduled_at,
  started_at,
  finished_at,
  created_at,
  updated_at;
`,
  values: [instanceId, jobId],
});
