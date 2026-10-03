import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export const queryRows = async <TRow>(
  executor: SqlExecutor,
  statement: SqlStatement
): Promise<readonly TRow[]> => {
  const result = await executor.execute<TRow>(statement);
  return result.rows;
};

export const toJsonSqlValue = (
  value: Readonly<Record<string, unknown>> | null | undefined
): string | null => (value ? JSON.stringify(value) : null);

export const jobSelectColumns = `
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
  updated_at
`;

export const eventSelectColumns = `
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
