import type {
  StudioJobCreateInput,
  StudioJobRecord,
  StudioJobUpdateInput,
} from '@sva/core';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

type StudioJobRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly plugin_id: string;
  readonly job_type_id: string;
  readonly import_profile_id: string | null;
  readonly queue_name: string;
  readonly status: StudioJobRecord['status'];
  readonly progress: Record<string, unknown> | null;
  readonly input_payload: Record<string, unknown>;
  readonly result_payload: Record<string, unknown> | null;
  readonly error_payload: Record<string, unknown> | null;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly idempotency_key: string;
  readonly request_id: string | null;
  readonly actor_account_id: string | null;
  readonly scheduled_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type StudioJobRepository = {
  createJob(input: StudioJobCreateInput): Promise<StudioJobRecord>;
  getJobById(instanceId: string, jobId: string): Promise<StudioJobRecord | null>;
  updateJobState(input: StudioJobUpdateInput): Promise<StudioJobRecord | null>;
};

const mapStudioJobRow = (row: StudioJobRow): StudioJobRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  pluginId: row.plugin_id,
  jobTypeId: row.job_type_id,
  importProfileId: row.import_profile_id ?? undefined,
  queueName: row.queue_name,
  status: row.status,
  progress: (row.progress as StudioJobRecord['progress'] | null) ?? undefined,
  inputPayload: row.input_payload,
  resultPayload: row.result_payload ?? undefined,
  errorPayload: row.error_payload ?? undefined,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  idempotencyKey: row.idempotency_key,
  requestId: row.request_id ?? undefined,
  actorAccountId: row.actor_account_id ?? undefined,
  scheduledAt: row.scheduled_at,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const queryRows = async <TRow>(executor: SqlExecutor, statement: SqlStatement): Promise<readonly TRow[]> => {
  const result = await executor.execute<TRow>(statement);
  return result.rows;
};

const toJsonSqlValue = (value: Readonly<Record<string, unknown>> | null | undefined): string | null =>
  value ? JSON.stringify(value) : null;

const createJobStatement = (input: StudioJobCreateInput): SqlStatement => ({
  text: `
INSERT INTO iam.plugin_operation_jobs (
  id,
  instance_id,
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
  scheduled_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, NULL, NULL, $10, $11, $12, $13, $14, $15)
RETURNING
  id,
  instance_id,
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
  scheduled_at,
  started_at,
  finished_at,
  created_at,
  updated_at
  `,
  values: [
    input.id,
    input.instanceId,
    input.pluginId,
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
    input.scheduledAt,
  ],
});

const getJobByIdStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
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
  scheduled_at,
  started_at,
  finished_at,
  created_at,
  updated_at
FROM iam.plugin_operation_jobs
WHERE instance_id = $1
  AND id = $2
  `,
  values: [instanceId, jobId],
});

const updateJobStateStatement = (input: StudioJobUpdateInput): SqlStatement => ({
  text: `
UPDATE iam.plugin_operation_jobs
SET
  status = $1,
  progress = $2::jsonb,
  attempts = $3,
  started_at = $4,
  finished_at = $5,
  result_payload = $6::jsonb,
  error_payload = $7::jsonb,
  updated_at = NOW()
WHERE instance_id = $8
  AND id = $9
RETURNING
  id,
  instance_id,
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
  scheduled_at,
  started_at,
  finished_at,
  created_at,
  updated_at
  `,
  values: [
    input.status,
    toJsonSqlValue(input.progress),
    input.attempts,
    input.startedAt ?? null,
    input.finishedAt ?? null,
    toJsonSqlValue(input.resultPayload),
    toJsonSqlValue(input.errorPayload),
    input.instanceId,
    input.jobId,
  ],
});

const requireStudioJobRow = (row: StudioJobRow | undefined, errorCode: string): StudioJobRow => {
  if (!row) {
    throw new Error(errorCode);
  }

  return row;
};

const createJob = async (executor: SqlExecutor, input: StudioJobCreateInput): Promise<StudioJobRecord> => {
  const rows = await queryRows<StudioJobRow>(executor, createJobStatement(input));
  return mapStudioJobRow(requireStudioJobRow(rows[0], `studio_job_create_failed:${input.id}`));
};

const getJobById = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, getJobByIdStatement(instanceId, jobId));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const updateJobState = async (
  executor: SqlExecutor,
  input: StudioJobUpdateInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobStateStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

export const createStudioJobRepository = (executor: SqlExecutor): StudioJobRepository => ({
  createJob: (input) => createJob(executor, input),
  getJobById: (instanceId, jobId) => getJobById(executor, instanceId, jobId),
  updateJobState: (input) => updateJobState(executor, input),
});
