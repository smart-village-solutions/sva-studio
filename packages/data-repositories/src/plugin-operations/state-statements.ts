import type { StudioJobRecord, StudioJobUpdateInput } from '@sva/core';
import type { SqlStatement } from '../iam/repositories/types.js';
import type { StudioJobRepository, StudioJobTerminalLeasePredicate } from './model.js';
import { jobSelectColumns, toJsonSqlValue } from './sql-shared.js';

export const updateJobStateStatement = (input: StudioJobUpdateInput): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET
  status = $1,
  progress = $2::jsonb,
  attempts = $3,
  started_at = $4,
  finished_at = $5,
  result_payload = $6::jsonb,
  error_payload = $7::jsonb,
  worker_id = $8,
  heartbeat_at = $9,
  updated_at = NOW()
WHERE instance_id = $10
  AND id = $11
RETURNING
${jobSelectColumns}
  `,
  values: [
    input.status,
    toJsonSqlValue(input.progress),
    input.attempts,
    input.startedAt ?? null,
    input.finishedAt ?? null,
    toJsonSqlValue(input.resultPayload),
    toJsonSqlValue(input.errorPayload),
    input.workerId ?? null,
    input.heartbeatAt ?? null,
    input.instanceId,
    input.jobId,
  ],
});

export const transitionJobStateStatement = (
  input: StudioJobUpdateInput & {
    readonly expectedStatuses: readonly StudioJobRecord['status'][];
    readonly expectedAttempts: number;
    readonly expectedWorkerId: string | null;
    readonly leasePredicate?: Extract<StudioJobTerminalLeasePredicate, { kind: 'activeOwner' }>;
  }
): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET status = $1, progress = $2::jsonb, attempts = $3, started_at = $4,
  finished_at = $5, result_payload = $6::jsonb, error_payload = $7::jsonb,
  worker_id = $8, heartbeat_at = $9, updated_at = NOW()
WHERE instance_id = $10 AND id = $11
  AND status = ANY($12::text[])
  AND attempts = $13
  AND worker_id IS NOT DISTINCT FROM $14
  ${
    input.leasePredicate?.kind === 'activeOwner'
      ? "AND COALESCE(heartbeat_at, started_at, updated_at) > NOW() - INTERVAL '120 seconds'"
      : ''
  }
RETURNING
${jobSelectColumns}
  `,
  values: [
    input.status,
    toJsonSqlValue(input.progress),
    input.attempts,
    input.startedAt ?? null,
    input.finishedAt ?? null,
    toJsonSqlValue(input.resultPayload),
    toJsonSqlValue(input.errorPayload),
    input.workerId ?? null,
    input.heartbeatAt ?? null,
    input.instanceId,
    input.jobId,
    input.expectedStatuses,
    input.expectedAttempts,
    input.expectedWorkerId,
  ],
});

export const transitionJobStateAndAppendEventStatement = (
  input: Parameters<StudioJobRepository['transitionJobStateAndAppendEvent']>[0]
): SqlStatement => ({
  text: `
WITH eligible AS MATERIALIZED (
  SELECT id
  FROM iam.studio_jobs
  WHERE instance_id = $10 AND id = $11
    AND status = ANY($12::text[]) AND attempts = $13
    AND worker_id IS NOT DISTINCT FROM $14
    AND ${
      input.leasePredicate.kind === 'activeOwner'
        ? "COALESCE(heartbeat_at, started_at, updated_at) > NOW() - INTERVAL '120 seconds'"
        : "COALESCE(heartbeat_at, started_at, updated_at) <= NOW() - INTERVAL '120 seconds'"
    }
    AND NOT EXISTS (
      SELECT 1
      FROM iam.studio_job_events AS existing_terminal
      WHERE existing_terminal.job_id = $11
        AND existing_terminal.attempts = $13
        AND existing_terminal.event_type IN ('job.succeeded', 'job.failed', 'job.cancelled')
    )
  FOR UPDATE
), terminal_event AS (
  INSERT INTO iam.studio_job_events (
    id, job_id, instance_id, event_type, status, progress, attempts, message, details
  )
  SELECT $15, $11, $10, $16, $1, $17::jsonb, $3, $18, $19::jsonb
  FROM eligible
  ON CONFLICT (job_id, attempts)
    WHERE event_type IN ('job.succeeded', 'job.failed', 'job.cancelled')
  DO NOTHING
  RETURNING job_id
), transitioned AS (
  UPDATE iam.studio_jobs AS job
  SET status = $1, progress = $2::jsonb, attempts = $3, started_at = $4,
    finished_at = $5, result_payload = $6::jsonb, error_payload = $7::jsonb,
    worker_id = $8, heartbeat_at = $9, updated_at = NOW()
  FROM terminal_event
  WHERE job.instance_id = $10 AND job.id = terminal_event.job_id
  RETURNING job.*
)
SELECT
${jobSelectColumns}
FROM transitioned
  `,
  values: [
    input.status,
    toJsonSqlValue(input.progress),
    input.attempts,
    input.startedAt ?? null,
    input.finishedAt ?? null,
    toJsonSqlValue(input.resultPayload),
    toJsonSqlValue(input.errorPayload),
    input.workerId ?? null,
    input.heartbeatAt ?? null,
    input.instanceId,
    input.jobId,
    input.expectedStatuses,
    input.expectedAttempts,
    input.expectedWorkerId,
    input.event.id,
    input.event.eventType,
    toJsonSqlValue(input.event.progress),
    input.event.message ?? null,
    toJsonSqlValue(input.event.details),
  ],
});
