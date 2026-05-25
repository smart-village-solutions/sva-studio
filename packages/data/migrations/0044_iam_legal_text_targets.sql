-- +goose Up
-- +goose StatementBegin
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_text_versions_instance_id_id
  ON iam.legal_text_versions(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.legal_text_target_roles (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (instance_id, legal_text_version_id)
    REFERENCES iam.legal_text_versions(instance_id, id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT legal_text_target_roles_unique UNIQUE (instance_id, legal_text_version_id, role_id)
);

CREATE TABLE IF NOT EXISTS iam.legal_text_target_groups (
  instance_id TEXT NOT NULL REFERENCES iam.instances(instance_id) ON DELETE CASCADE,
  legal_text_version_id UUID NOT NULL,
  group_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (instance_id, legal_text_version_id)
    REFERENCES iam.legal_text_versions(instance_id, id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE,
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
DROP INDEX IF EXISTS iam.uq_legal_text_versions_instance_id_id;
-- +goose StatementEnd
