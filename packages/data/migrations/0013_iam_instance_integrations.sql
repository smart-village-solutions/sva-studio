-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.instance_integrations (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  graphql_base_url TEXT NOT NULL,
  oauth_token_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  last_verified_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_instance_integrations_instance_provider
  ON iam.instance_integrations(instance_id, provider_key);

ALTER TABLE iam.instance_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_integrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_integrations_isolation_policy ON iam.instance_integrations;
CREATE POLICY instance_integrations_isolation_policy
  ON iam.instance_integrations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS instance_integrations_isolation_policy ON iam.instance_integrations;
DROP INDEX IF EXISTS iam.idx_instance_integrations_instance_provider;
DROP TABLE IF EXISTS iam.instance_integrations;
-- +goose StatementEnd
