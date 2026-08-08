-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.permission_cache_instance_revisions (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_cache_instance_revisions_positive_chk CHECK (revision > 0)
);

CREATE TABLE iam.permission_cache_user_revisions (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  keycloak_subject TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_cache_user_revisions_pkey PRIMARY KEY (instance_id, keycloak_subject),
  CONSTRAINT permission_cache_user_revisions_subject_chk CHECK (length(btrim(keycloak_subject)) > 0),
  CONSTRAINT permission_cache_user_revisions_positive_chk CHECK (revision > 0)
);

ALTER TABLE iam.permission_cache_instance_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.permission_cache_instance_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY permission_cache_instance_revisions_isolation_policy
  ON iam.permission_cache_instance_revisions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.permission_cache_user_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.permission_cache_user_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY permission_cache_user_revisions_isolation_policy
  ON iam.permission_cache_user_revisions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS permission_cache_user_revisions_isolation_policy
  ON iam.permission_cache_user_revisions;
DROP TABLE IF EXISTS iam.permission_cache_user_revisions;

DROP POLICY IF EXISTS permission_cache_instance_revisions_isolation_policy
  ON iam.permission_cache_instance_revisions;
DROP TABLE IF EXISTS iam.permission_cache_instance_revisions;
-- +goose StatementEnd
