import type {
  StudioJobCancellationRequestInput,
  StudioJobCreateInput,
  StudioJobDetail,
  StudioJobEventCreateInput,
  StudioJobEventDetails,
  StudioJobEventRecord,
  StudioJobHeartbeatInput,
  StudioJobListQuery,
  StudioJobProgressUpdateInput,
  StudioJobRecord,
  StudioJobUpdateInput,
} from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';

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
  readonly worker_id: string | null;
  readonly heartbeat_at: string | null;
  readonly last_progress_at: string | null;
  readonly cancel_requested_at: string | null;
  readonly correlation_id: string | null;
  readonly parent_job_id: string | null;
  readonly scheduled_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type StudioJobEventRow = {
  readonly id: string;
  readonly job_id: string;
  readonly instance_id: string;
  readonly event_type: StudioJobEventRecord['eventType'];
  readonly status: StudioJobRecord['status'];
  readonly progress: Record<string, unknown> | null;
  readonly attempts: number;
  readonly message: string | null;
  readonly details: Record<string, unknown> | null;
  readonly created_at: string;
};

type StudioJobListRow = StudioJobRow & {
  readonly latest_event_id: string | null;
  readonly latest_event_type: StudioJobEventRecord['eventType'] | null;
  readonly latest_event_status: StudioJobRecord['status'] | null;
  readonly latest_event_progress: Record<string, unknown> | null;
  readonly latest_event_attempts: number | null;
  readonly latest_event_message: string | null;
  readonly latest_event_details: Record<string, unknown> | null;
  readonly latest_event_created_at: string | null;
  readonly total_count: number;
};

export type StudioJobListResultItem = StudioJobRecord & {
  readonly latestEvent?: StudioJobEventRecord;
};

export type StudioJobListResult = {
  readonly items: readonly StudioJobListResultItem[];
  readonly total: number;
};

export type StudioJobRepository = {
  createJob(input: StudioJobCreateInput): Promise<StudioJobRecord>;
  getJobById(instanceId: string, jobId: string): Promise<StudioJobRecord | null>;
  getJobDetail(instanceId: string, jobId: string): Promise<StudioJobDetail | null>;
  listJobs(instanceId: string, query: StudioJobListQuery): Promise<StudioJobListResult>;
  updateJobState(input: StudioJobUpdateInput): Promise<StudioJobRecord | null>;
  updateJobProgress(input: StudioJobProgressUpdateInput): Promise<StudioJobRecord | null>;
  touchJobHeartbeat(input: StudioJobHeartbeatInput): Promise<StudioJobRecord | null>;
  requestJobCancellation(input: StudioJobCancellationRequestInput): Promise<StudioJobRecord | null>;
  appendJobEvent(input: StudioJobEventCreateInput): Promise<StudioJobEventRecord>;
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
  errorPayload: (row.error_payload as StudioJobRecord['errorPayload'] | null) ?? undefined,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  idempotencyKey: row.idempotency_key,
  requestId: row.request_id ?? undefined,
  actorAccountId: row.actor_account_id ?? undefined,
  workerId: row.worker_id ?? undefined,
  heartbeatAt: row.heartbeat_at ?? undefined,
  lastProgressAt: row.last_progress_at ?? undefined,
  cancelRequestedAt: row.cancel_requested_at ?? undefined,
  correlationId: row.correlation_id ?? undefined,
  parentJobId: row.parent_job_id ?? undefined,
  scheduledAt: row.scheduled_at,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapStudioJobEventRow = (row: StudioJobEventRow): StudioJobEventRecord => ({
  id: row.id,
  jobId: row.job_id,
  instanceId: row.instance_id,
  eventType: row.event_type,
  status: row.status,
  progress: (row.progress as StudioJobEventRecord['progress'] | null) ?? undefined,
  attempts: row.attempts,
  message: row.message ?? undefined,
  details: (row.details as StudioJobEventDetails | null) ?? undefined,
  createdAt: row.created_at,
});

const mapStudioJobListRow = (row: StudioJobListRow): StudioJobListResultItem => ({
  ...mapStudioJobRow(row),
  ...(row.latest_event_id
    ? {
        latestEvent: {
          id: row.latest_event_id,
          jobId: row.id,
          instanceId: row.instance_id,
          eventType: row.latest_event_type ?? 'job.queued',
          status: row.latest_event_status ?? row.status,
          progress: (row.latest_event_progress as StudioJobEventRecord['progress'] | null) ?? undefined,
          attempts: row.latest_event_attempts ?? row.attempts,
          message: row.latest_event_message ?? undefined,
          details: (row.latest_event_details as StudioJobEventDetails | null) ?? undefined,
          createdAt: row.latest_event_created_at ?? row.updated_at,
        },
      }
    : {}),
});

const queryRows = async <TRow>(executor: SqlExecutor, statement: SqlStatement): Promise<readonly TRow[]> => {
  const result = await executor.execute<TRow>(statement);
  return result.rows;
};

const toJsonSqlValue = (value: Readonly<Record<string, unknown>> | null | undefined): string | null =>
  value ? JSON.stringify(value) : null;

const jobSelectColumns = `
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
  updated_at
`;

const eventSelectColumns = `
  id,
  job_id,
  instance_id,
  event_type,
  status,
  progress,
  attempts,
  message,
  details,
  created_at
`;

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
  $8::jsonb,
  $9::jsonb,
  NULL,
  NULL,
  $10,
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
  $21
)
RETURNING
${jobSelectColumns}
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
    input.workerId ?? null,
    input.heartbeatAt ?? null,
    input.lastProgressAt ?? null,
    input.cancelRequestedAt ?? null,
    input.correlationId ?? null,
    input.parentJobId ?? null,
    input.scheduledAt,
  ],
});

const getJobByIdStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
SELECT
${jobSelectColumns}
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

const updateJobProgressStatement = (input: StudioJobProgressUpdateInput): SqlStatement => ({
  text: `
UPDATE iam.plugin_operation_jobs
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

const touchJobHeartbeatStatement = (input: StudioJobHeartbeatInput): SqlStatement => ({
  text: `
UPDATE iam.plugin_operation_jobs
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

const requestJobCancellationStatement = (input: StudioJobCancellationRequestInput): SqlStatement => ({
  text: `
UPDATE iam.plugin_operation_jobs
SET
  cancel_requested_at = $1,
  updated_at = NOW()
WHERE instance_id = $2
  AND id = $3
RETURNING
${jobSelectColumns}
  `,
  values: [input.cancelRequestedAt, input.instanceId, input.jobId],
});

const createJobEventStatement = (input: StudioJobEventCreateInput): SqlStatement => ({
  text: `
INSERT INTO iam.plugin_operation_job_events (
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

const listJobEventsStatement = (instanceId: string, jobId: string): SqlStatement => ({
  text: `
SELECT
${eventSelectColumns}
FROM iam.plugin_operation_job_events
WHERE instance_id = $1
  AND job_id = $2
ORDER BY created_at ASC
  `,
  values: [instanceId, jobId],
});

const buildListJobWhereClause = (
  instanceId: string,
  query: StudioJobListQuery
): { readonly clause: string; readonly values: readonly SqlPrimitive[] } => {
  const conditions = ['j.instance_id = $1'];
  const values: SqlPrimitive[] = [instanceId];

  if (query.view === 'active') {
    conditions.push(`j.status IN ('queued', 'running', 'retrying')`);
  }

  if (query.view === 'history') {
    conditions.push(`j.status IN ('succeeded', 'failed', 'cancelled')`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`j.status = $${values.length}`);
  }

  if (query.pluginId) {
    values.push(query.pluginId);
    conditions.push(`j.plugin_id = $${values.length}`);
  }

  if (query.jobTypeId) {
    values.push(query.jobTypeId);
    conditions.push(`j.job_type_id = $${values.length}`);
  }

  if (query.q) {
    values.push(`%${query.q}%`);
    const parameterIndex = values.length;
    conditions.push(
      `(j.id::text ILIKE $${parameterIndex} OR COALESCE(j.correlation_id, '') ILIKE $${parameterIndex} OR COALESCE(j.parent_job_id::text, '') ILIKE $${parameterIndex})`
    );
  }

  return {
    clause: conditions.join('\n  AND '),
    values,
  };
};

const listJobsStatement = (instanceId: string, query: StudioJobListQuery): SqlStatement => {
  const paginationOffset = (query.page - 1) * query.pageSize;
  const whereClause = buildListJobWhereClause(instanceId, query);
  const pageSizeIndex = whereClause.values.length + 1;
  const offsetIndex = whereClause.values.length + 2;

  return {
    text: `
WITH filtered_jobs AS (
  SELECT
    ${jobSelectColumns}
  FROM iam.plugin_operation_jobs j
  WHERE ${whereClause.clause}
)
SELECT
  filtered_jobs.*,
  latest_event.id AS latest_event_id,
  latest_event.event_type AS latest_event_type,
  latest_event.status AS latest_event_status,
  latest_event.progress AS latest_event_progress,
  latest_event.attempts AS latest_event_attempts,
  latest_event.message AS latest_event_message,
  latest_event.details AS latest_event_details,
  latest_event.created_at AS latest_event_created_at,
  COUNT(*) OVER()::int AS total_count
FROM filtered_jobs
LEFT JOIN LATERAL (
  SELECT
    ${eventSelectColumns}
  FROM iam.plugin_operation_job_events event
  WHERE event.instance_id = filtered_jobs.instance_id
    AND event.job_id = filtered_jobs.id
  ORDER BY event.created_at DESC
  LIMIT 1
) latest_event ON TRUE
ORDER BY
  COALESCE(filtered_jobs.started_at, filtered_jobs.scheduled_at, filtered_jobs.created_at) DESC,
  filtered_jobs.created_at DESC
LIMIT $${pageSizeIndex}
OFFSET $${offsetIndex}
    `,
    values: [...whereClause.values, query.pageSize, paginationOffset],
  };
};

const requireFirstRow = <TRow>(row: TRow | undefined, errorCode: string): TRow => {
  if (!row) {
    throw new Error(errorCode);
  }

  return row;
};

const createJob = async (executor: SqlExecutor, input: StudioJobCreateInput): Promise<StudioJobRecord> => {
  const rows = await queryRows<StudioJobRow>(executor, createJobStatement(input));
  return mapStudioJobRow(requireFirstRow(rows[0], `studio_job_create_failed:${input.id}`));
};

const getJobById = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, getJobByIdStatement(instanceId, jobId));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const getJobDetail = async (
  executor: SqlExecutor,
  instanceId: string,
  jobId: string
): Promise<StudioJobDetail | null> => {
  const job = await getJobById(executor, instanceId, jobId);
  if (!job) {
    return null;
  }

  const eventRows = await queryRows<StudioJobEventRow>(executor, listJobEventsStatement(instanceId, jobId));
  return {
    ...job,
    history: eventRows.map(mapStudioJobEventRow),
  };
};

const listJobs = async (
  executor: SqlExecutor,
  instanceId: string,
  query: StudioJobListQuery
): Promise<StudioJobListResult> => {
  const rows = await queryRows<StudioJobListRow>(executor, listJobsStatement(instanceId, query));
  return {
    items: rows.map(mapStudioJobListRow),
    total: rows[0]?.total_count ?? 0,
  };
};

const updateJobState = async (
  executor: SqlExecutor,
  input: StudioJobUpdateInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobStateStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const updateJobProgress = async (
  executor: SqlExecutor,
  input: StudioJobProgressUpdateInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, updateJobProgressStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const touchJobHeartbeat = async (
  executor: SqlExecutor,
  input: StudioJobHeartbeatInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, touchJobHeartbeatStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const requestJobCancellation = async (
  executor: SqlExecutor,
  input: StudioJobCancellationRequestInput
): Promise<StudioJobRecord | null> => {
  const rows = await queryRows<StudioJobRow>(executor, requestJobCancellationStatement(input));
  return rows[0] ? mapStudioJobRow(rows[0]) : null;
};

const appendJobEvent = async (
  executor: SqlExecutor,
  input: StudioJobEventCreateInput
): Promise<StudioJobEventRecord> => {
  const rows = await queryRows<StudioJobEventRow>(executor, createJobEventStatement(input));
  return mapStudioJobEventRow(requireFirstRow(rows[0], `studio_job_event_create_failed:${input.id}`));
};

export const createStudioJobRepository = (executor: SqlExecutor): StudioJobRepository => ({
  createJob: (input) => createJob(executor, input),
  getJobById: (instanceId, jobId) => getJobById(executor, instanceId, jobId),
  getJobDetail: (instanceId, jobId) => getJobDetail(executor, instanceId, jobId),
  listJobs: (instanceId, query) => listJobs(executor, instanceId, query),
  updateJobState: (input) => updateJobState(executor, input),
  updateJobProgress: (input) => updateJobProgress(executor, input),
  touchJobHeartbeat: (input) => touchJobHeartbeat(executor, input),
  requestJobCancellation: (input) => requestJobCancellation(executor, input),
  appendJobEvent: (input) => appendJobEvent(executor, input),
});
