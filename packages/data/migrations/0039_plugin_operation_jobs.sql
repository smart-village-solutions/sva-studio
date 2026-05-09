-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.plugin_operation_jobs (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  job_type_id TEXT NOT NULL,
  import_profile_id TEXT,
  queue_name TEXT NOT NULL,
  status TEXT NOT NULL,
  progress JSONB,
  input_payload JSONB NOT NULL,
  result_payload JSONB,
  error_payload JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  request_id TEXT,
  actor_account_id TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plugin_operation_jobs_status_check CHECK (
    status IN ('queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled')
  ),
  CONSTRAINT plugin_operation_jobs_attempts_check CHECK (attempts >= 0),
  CONSTRAINT plugin_operation_jobs_max_attempts_check CHECK (max_attempts >= 1)
);

CREATE INDEX IF NOT EXISTS idx_plugin_operation_jobs_instance_created_at
  ON iam.plugin_operation_jobs(instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_operation_jobs_instance_status_updated_at
  ON iam.plugin_operation_jobs(instance_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_operation_jobs_instance_idempotency_key
  ON iam.plugin_operation_jobs(instance_id, idempotency_key);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_idempotency_key;
DROP INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_status_updated_at;
DROP INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_created_at;
DROP TABLE IF EXISTS iam.plugin_operation_jobs;
-- +goose StatementEnd
