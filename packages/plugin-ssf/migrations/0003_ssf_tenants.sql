-- +goose Up
-- +goose StatementBegin
CREATE TABLE ssf.tenants (
  instance_id varchar(128) PRIMARY KEY,
  status varchar(16) NOT NULL DEFAULT 'prepared',
  revision bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_instance_id_check CHECK (char_length(instance_id) > 0),
  CONSTRAINT tenants_status_check CHECK (status = 'prepared'),
  CONSTRAINT tenants_revision_check CHECK (revision > 0)
);

ALTER TABLE ssf.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_root_policy
  ON ssf.tenants
  FOR ALL
  TO ssf_plugin_root
  USING (true)
  WITH CHECK (true);
CREATE POLICY tenants_tenant_read_policy
  ON ssf.tenants
  FOR SELECT
  TO ssf_plugin_tenant_runtime
  USING (instance_id = (SELECT ssf.current_instance_id()));

GRANT SELECT, INSERT, UPDATE ON ssf.tenants TO ssf_plugin_root;
REVOKE DELETE ON ssf.tenants FROM ssf_plugin_root;
GRANT SELECT (instance_id, status, revision, created_at, updated_at)
  ON ssf.tenants TO ssf_plugin_tenant_runtime;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS ssf.tenants;
-- +goose StatementEnd
