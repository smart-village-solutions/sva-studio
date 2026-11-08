-- +goose Up
CREATE TABLE IF NOT EXISTS iam.application_workspace_settings (
  instance_id text PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  tiles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tiles) = 'array' AND jsonb_array_length(tiles) <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iam.application_workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.application_workspace_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS application_workspace_settings_instance_scope ON iam.application_workspace_settings;
CREATE POLICY application_workspace_settings_instance_scope ON iam.application_workspace_settings
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
GRANT SELECT, INSERT, UPDATE ON iam.application_workspace_settings TO iam_app;

-- +goose Down
-- Preserve municipal configuration when an older runtime is restored.
SELECT 1;
