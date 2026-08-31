-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_plugin_lifecycle
  ADD COLUMN next_recheck_at TIMESTAMPTZ,
  ADD COLUMN contract_revision TEXT,
  ADD COLUMN recovery_error_code TEXT;

UPDATE iam.instance_plugin_lifecycle
SET next_recheck_at = COALESCE(retry_after, NOW())
WHERE readiness_status = 'pending';

ALTER TABLE iam.instance_plugin_lifecycle
  ALTER COLUMN next_recheck_at SET DEFAULT (NOW() + INTERVAL '120 seconds');

ALTER TABLE iam.instance_plugin_lifecycle
  ADD CONSTRAINT instance_plugin_lifecycle_pending_recheck_chk
  CHECK (readiness_status <> 'pending' OR next_recheck_at IS NOT NULL);

CREATE INDEX idx_instance_plugin_lifecycle_recheck
  ON iam.instance_plugin_lifecycle(next_recheck_at, instance_id, plugin_id)
  WHERE next_recheck_at IS NOT NULL;

CREATE UNIQUE INDEX idx_studio_job_events_terminal_attempt
  ON iam.studio_job_events(job_id, attempts)
  WHERE event_type IN ('job.succeeded', 'job.failed', 'job.cancelled');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_studio_job_events_terminal_attempt;
DROP INDEX IF EXISTS iam.idx_instance_plugin_lifecycle_recheck;
ALTER TABLE iam.instance_plugin_lifecycle
  DROP CONSTRAINT IF EXISTS instance_plugin_lifecycle_pending_recheck_chk,
  DROP COLUMN IF EXISTS recovery_error_code,
  DROP COLUMN IF EXISTS contract_revision,
  DROP COLUMN IF EXISTS next_recheck_at;
-- +goose StatementEnd
