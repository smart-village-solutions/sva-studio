-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.plugin_operation_jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS parent_job_id UUID;

CREATE INDEX IF NOT EXISTS idx_plugin_operation_jobs_instance_heartbeat_at
  ON iam.plugin_operation_jobs(instance_id, heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS iam.plugin_operation_job_events (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES iam.plugin_operation_jobs(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plugin_operation_job_events_type_check CHECK (
    event_type IN (
      'job.queued',
      'job.started',
      'job.progressed',
      'job.retrying',
      'job.succeeded',
      'job.failed',
      'job.cancelled'
    )
  ),
  CONSTRAINT plugin_operation_job_events_status_check CHECK (
    status IN ('queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_plugin_operation_job_events_job_created_at
  ON iam.plugin_operation_job_events(instance_id, job_id, created_at ASC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_plugin_operation_job_events_job_created_at;
DROP TABLE IF EXISTS iam.plugin_operation_job_events;
DROP INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_heartbeat_at;
ALTER TABLE iam.plugin_operation_jobs
  DROP COLUMN IF EXISTS parent_job_id,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS cancel_requested_at,
  DROP COLUMN IF EXISTS last_progress_at,
  DROP COLUMN IF EXISTS heartbeat_at,
  DROP COLUMN IF EXISTS worker_id;
-- +goose StatementEnd
