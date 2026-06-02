-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.organization_mainserver_credentials (
  instance_id TEXT NOT NULL,
  organization_id UUID NOT NULL,
  mainserver_application_id TEXT,
  mainserver_application_secret_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_account_id UUID,
  CONSTRAINT organization_mainserver_credentials_pkey PRIMARY KEY (instance_id, organization_id),
  CONSTRAINT organization_mainserver_credentials_org_fk
    FOREIGN KEY (instance_id, organization_id)
    REFERENCES iam.organizations (instance_id, id)
    ON DELETE CASCADE,
  CONSTRAINT organization_mainserver_credentials_updated_by_fk
    FOREIGN KEY (updated_by_account_id)
    REFERENCES iam.accounts (id)
    ON DELETE SET NULL
);

ALTER TABLE iam.organization_mainserver_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.organization_mainserver_credentials FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_mainserver_credentials_isolation_policy
  ON iam.organization_mainserver_credentials;
CREATE POLICY organization_mainserver_credentials_isolation_policy
  ON iam.organization_mainserver_credentials
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS organization_mainserver_credentials_isolation_policy
  ON iam.organization_mainserver_credentials;
DROP TABLE IF EXISTS iam.organization_mainserver_credentials;
-- +goose StatementEnd
