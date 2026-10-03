import type {
  StudioJobCancellationRequestInput,
  StudioJobHeartbeatInput,
  StudioJobProgressUpdateInput,
} from '@sva/core';
import type { SqlStatement } from '../iam/repositories/types.js';
import { jobSelectColumns, toJsonSqlValue } from './sql-shared.js';

export const updateJobProgressStatement = (input: StudioJobProgressUpdateInput): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET
  progress = $1::jsonb,
  last_progress_at = $2,
  heartbeat_at = COALESCE($3, heartbeat_at),
  updated_at = NOW()
WHERE instance_id = $4
  AND id = $5
RETURNING
${jobSelectColumns}
  `,
  values: [
    toJsonSqlValue(input.progress),
    input.lastProgressAt,
    input.heartbeatAt ?? null,
    input.instanceId,
    input.jobId,
  ],
});

export const updateJobProgressWithLeaseStatement = (
  input: StudioJobProgressUpdateInput & { readonly attempts: number; readonly workerId: string }
): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET progress = $1::jsonb, last_progress_at = $2, heartbeat_at = $3, updated_at = NOW()
WHERE instance_id = $4 AND id = $5 AND status = 'running'
  AND attempts = $6 AND worker_id = $7
  AND heartbeat_at > NOW() - INTERVAL '120 seconds'
RETURNING
${jobSelectColumns}
  `,
  values: [
    toJsonSqlValue(input.progress),
    input.lastProgressAt,
    input.heartbeatAt ?? input.lastProgressAt,
    input.instanceId,
    input.jobId,
    input.attempts,
    input.workerId,
  ],
});

export const touchJobHeartbeatStatement = (input: StudioJobHeartbeatInput): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET
  heartbeat_at = $1,
  worker_id = COALESCE($2, worker_id),
  updated_at = NOW()
WHERE instance_id = $3
  AND id = $4
RETURNING
${jobSelectColumns}
  `,
  values: [input.heartbeatAt, input.workerId ?? null, input.instanceId, input.jobId],
});

export const touchJobHeartbeatWithLeaseStatement = (
  input: StudioJobHeartbeatInput & { readonly attempts: number; readonly workerId: string }
): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET heartbeat_at = $1, updated_at = NOW()
WHERE instance_id = $2 AND id = $3 AND status = 'running'
  AND attempts = $4 AND worker_id = $5
  AND heartbeat_at > NOW() - INTERVAL '120 seconds'
RETURNING
${jobSelectColumns}
  `,
  values: [input.heartbeatAt, input.instanceId, input.jobId, input.attempts, input.workerId],
});

export const requestJobCancellationStatement = (
  input: StudioJobCancellationRequestInput
): SqlStatement => ({
  text: `
UPDATE iam.studio_jobs
SET
  cancel_requested_at = $1,
  updated_at = NOW()
WHERE instance_id = $2
  AND id = $3
  AND status IN ('queued', 'running', 'retrying')
  AND cancel_requested_at IS NULL
RETURNING
${jobSelectColumns}
  `,
  values: [input.cancelRequestedAt, input.instanceId, input.jobId],
});
