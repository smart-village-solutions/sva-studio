-- +goose Up
-- +goose StatementBegin
CREATE TABLE ssf.authorization_projections (
  instance_id varchar(128) PRIMARY KEY,
  generation bigint NOT NULL DEFAULT 1,
  status varchar(32) NOT NULL DEFAULT 'pending',
  desired_revision char(71) NOT NULL,
  desired_projection jsonb NOT NULL,
  confirmed_revision char(71),
  confirmed_projection jsonb,
  sessions_revoked_revision char(71),
  last_error_code varchar(64),
  confirmed_at timestamptz,
  sessions_revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authorization_projections_instance_id_check CHECK (
    char_length(instance_id) > 0
  ),
  CONSTRAINT authorization_projections_generation_check CHECK (generation > 0),
  CONSTRAINT authorization_projections_status_check CHECK (
    status IN ('pending', 'projecting', 'revocation_pending', 'ready', 'blocked')
  ),
  CONSTRAINT authorization_projections_desired_revision_check CHECK (
    desired_revision ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT authorization_projections_confirmed_revision_check CHECK (
    confirmed_revision IS NULL OR confirmed_revision ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT authorization_projections_revoked_revision_check CHECK (
    sessions_revoked_revision IS NULL
    OR sessions_revoked_revision ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT authorization_projections_confirmed_pair_check CHECK (
    (confirmed_revision IS NULL) = (confirmed_projection IS NULL)
  ),
  CONSTRAINT authorization_projections_ready_check CHECK (
    status <> 'ready'
    OR (
      confirmed_revision = desired_revision
      AND sessions_revoked_revision = confirmed_revision
      AND last_error_code IS NULL
    )
  )
);

ALTER TABLE ssf.authorization_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf.authorization_projections FORCE ROW LEVEL SECURITY;
CREATE POLICY authorization_projections_root_policy
  ON ssf.authorization_projections
  FOR ALL
  TO ssf_plugin_root
  USING (true)
  WITH CHECK (true);
CREATE POLICY authorization_projections_tenant_readiness_policy
  ON ssf.authorization_projections
  FOR SELECT
  TO ssf_plugin_tenant_runtime
  USING (instance_id = ssf.current_instance_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON ssf.authorization_projections TO ssf_plugin_root;
GRANT SELECT (
  instance_id,
  generation,
  status,
  desired_revision,
  confirmed_revision,
  sessions_revoked_revision,
  last_error_code
) ON ssf.authorization_projections TO ssf_plugin_tenant_runtime;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS ssf.authorization_projections;
-- +goose StatementEnd
