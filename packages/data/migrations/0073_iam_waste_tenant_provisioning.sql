-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.instance_waste_provisioning (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  desired_generation INTEGER NOT NULL DEFAULT 1,
  completed_generation INTEGER NOT NULL DEFAULT 0,
  database_name TEXT,
  interface_id TEXT,
  active_job_id UUID,
  error_code TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instance_waste_provisioning_status_chk
    CHECK (status IN ('provisioning', 'ready', 'failed', 'disabled')),
  CONSTRAINT instance_waste_provisioning_generation_chk
    CHECK (desired_generation >= 1 AND completed_generation >= 0 AND completed_generation <= desired_generation),
  CONSTRAINT instance_waste_provisioning_database_name_chk
    CHECK (database_name IS NULL OR database_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  CONSTRAINT instance_waste_provisioning_interface_fk
    FOREIGN KEY (interface_id) REFERENCES iam.instance_external_interfaces(id) ON DELETE SET NULL,
  CONSTRAINT instance_waste_provisioning_job_fk
    FOREIGN KEY (active_job_id, instance_id) REFERENCES iam.studio_jobs(id, instance_id) ON DELETE SET NULL
);

CREATE INDEX idx_instance_waste_provisioning_status_updated_at
  ON iam.instance_waste_provisioning(status, updated_at DESC);

ALTER TABLE iam.instance_waste_provisioning ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_waste_provisioning FORCE ROW LEVEL SECURITY;
CREATE POLICY instance_waste_provisioning_isolation_policy
  ON iam.instance_waste_provisioning
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS instance_waste_provisioning_isolation_policy ON iam.instance_waste_provisioning;
DROP INDEX IF EXISTS iam.idx_instance_waste_provisioning_status_updated_at;
DROP TABLE IF EXISTS iam.instance_waste_provisioning;
-- +goose StatementEnd

