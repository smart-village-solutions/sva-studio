-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.legal_text_target_roles (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL REFERENCES iam.legal_text_versions(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_text_target_roles_unique UNIQUE (instance_id, legal_text_version_id, role_id)
);

CREATE TABLE IF NOT EXISTS iam.legal_text_target_groups (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL REFERENCES iam.legal_text_versions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES iam.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_text_target_groups_unique UNIQUE (instance_id, legal_text_version_id, group_id)
);

ALTER TABLE iam.legal_text_target_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.legal_text_target_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY legal_text_target_roles_isolation_policy
  ON iam.legal_text_target_roles
  USING (instance_id = current_setting('app.current_instance_id', true));

CREATE POLICY legal_text_target_groups_isolation_policy
  ON iam.legal_text_target_groups
  USING (instance_id = current_setting('app.current_instance_id', true));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS legal_text_target_groups_isolation_policy ON iam.legal_text_target_groups;
DROP POLICY IF EXISTS legal_text_target_roles_isolation_policy ON iam.legal_text_target_roles;
DROP TABLE IF EXISTS iam.legal_text_target_groups;
DROP TABLE IF EXISTS iam.legal_text_target_roles;
-- +goose StatementEnd
