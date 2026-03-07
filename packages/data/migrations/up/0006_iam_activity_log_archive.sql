CREATE TABLE IF NOT EXISTS iam.activity_logs_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  activity_log_id UUID NOT NULL,
  account_id UUID,
  subject_id UUID,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  original_created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_logs_archive_activity_log_unique UNIQUE (activity_log_id),
  CONSTRAINT activity_logs_archive_result_chk CHECK (result IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_archive_instance_created
  ON iam.activity_logs_archive(instance_id, original_created_at DESC);

ALTER TABLE iam.activity_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.activity_logs_archive FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_logs_archive_isolation_policy ON iam.activity_logs_archive;
CREATE POLICY activity_logs_archive_isolation_policy
  ON iam.activity_logs_archive
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
