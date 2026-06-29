-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.instance_waste_data_sources (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  project_url TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  database_url_ciphertext TEXT,
  service_role_key_ciphertext TEXT,
  visible_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  last_check_status TEXT,
  last_check_error_code TEXT,
  last_check_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instance_waste_data_sources_visible_status_chk CHECK (
    visible_status IN ('not_configured', 'unknown', 'ok', 'error', 'disabled')
  ),
  CONSTRAINT instance_waste_data_sources_last_check_status_chk CHECK (
    last_check_status IS NULL OR last_check_status IN ('succeeded', 'failed')
  )
);

ALTER TABLE iam.instance_waste_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_waste_data_sources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_waste_data_sources_isolation_policy ON iam.instance_waste_data_sources;
CREATE POLICY instance_waste_data_sources_isolation_policy
  ON iam.instance_waste_data_sources
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS instance_waste_data_sources_isolation_policy ON iam.instance_waste_data_sources;
DROP TABLE IF EXISTS iam.instance_waste_data_sources;
-- +goose StatementEnd
