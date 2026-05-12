-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.external_interface_types (
  type_key TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  public_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_check_kind TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_interface_types_owner_kind_chk CHECK (owner_kind IN ('host', 'plugin')),
  CONSTRAINT external_interface_types_category_chk CHECK (category IN ('api', 'object_storage', 'database', 'feed')),
  CONSTRAINT external_interface_types_status_check_kind_chk CHECK (
    status_check_kind IN ('none', 'sva_mainserver', 's3', 'supabase')
  )
);

CREATE TABLE IF NOT EXISTS iam.instance_external_interfaces (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  type_key TEXT NOT NULL REFERENCES iam.external_interface_types(type_key),
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  alias TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL,
  base_url TEXT,
  auth_mode TEXT,
  public_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_config_ciphertext TEXT,
  status_check_kind TEXT NOT NULL,
  visible_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  last_check_status TEXT,
  last_check_error_code TEXT,
  last_check_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT instance_external_interfaces_owner_kind_chk CHECK (owner_kind IN ('host', 'plugin')),
  CONSTRAINT instance_external_interfaces_category_chk CHECK (category IN ('api', 'object_storage', 'database', 'feed')),
  CONSTRAINT instance_external_interfaces_status_check_kind_chk CHECK (
    status_check_kind IN ('none', 'sva_mainserver', 's3', 'supabase')
  ),
  CONSTRAINT instance_external_interfaces_visible_status_chk CHECK (
    visible_status IN ('not_configured', 'unknown', 'ok', 'error', 'disabled')
  ),
  CONSTRAINT instance_external_interfaces_last_check_status_chk CHECK (
    last_check_status IS NULL OR last_check_status IN ('succeeded', 'failed')
  ),
  CONSTRAINT instance_external_interfaces_instance_type_alias_key UNIQUE (instance_id, type_key, alias)
);

CREATE INDEX IF NOT EXISTS idx_instance_external_interfaces_instance_type
  ON iam.instance_external_interfaces(instance_id, type_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_external_interfaces_default_per_type
  ON iam.instance_external_interfaces(instance_id, type_key)
  WHERE is_default = true;

ALTER TABLE iam.instance_external_interfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_external_interfaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_external_interfaces_isolation_policy ON iam.instance_external_interfaces;
CREATE POLICY instance_external_interfaces_isolation_policy
  ON iam.instance_external_interfaces
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

INSERT INTO iam.external_interface_types (
  type_key,
  owner_kind,
  owner_id,
  display_name,
  category,
  public_schema_json,
  secret_schema_json,
  status_check_kind,
  enabled
)
VALUES
  (
    'sva_mainserver',
    'host',
    'host',
    'SVA Mainserver',
    'api',
    '{"graphqlBaseUrl":{"type":"string","format":"uri"},"oauthTokenUrl":{"type":"string","format":"uri"}}'::jsonb,
    '{}'::jsonb,
    'sva_mainserver',
    true
  ),
  (
    's3',
    'host',
    'host',
    'S3',
    'object_storage',
    '{"endpoint":{"type":"string","format":"uri"},"region":{"type":"string"},"bucket":{"type":"string"},"accessKeyId":{"type":"string"},"forcePathStyle":{"type":"boolean"}}'::jsonb,
    '{"secretAccessKey":{"type":"string"}}'::jsonb,
    's3',
    true
  ),
  (
    'supabase',
    'host',
    'host',
    'Supabase',
    'database',
    '{"projectUrl":{"type":"string","format":"uri"},"schemaName":{"type":"string"}}'::jsonb,
    '{"databaseUrl":{"type":"string"},"serviceRoleKey":{"type":"string"}}'::jsonb,
    'supabase',
    true
  )
ON CONFLICT (type_key) DO UPDATE
SET owner_kind = EXCLUDED.owner_kind,
    owner_id = EXCLUDED.owner_id,
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    public_schema_json = EXCLUDED.public_schema_json,
    secret_schema_json = EXCLUDED.secret_schema_json,
    status_check_kind = EXCLUDED.status_check_kind,
    enabled = EXCLUDED.enabled,
    updated_at = now();

INSERT INTO iam.instance_external_interfaces (
  id,
  instance_id,
  type_key,
  owner_kind,
  owner_id,
  display_name,
  alias,
  enabled,
  is_default,
  category,
  base_url,
  auth_mode,
  public_config_json,
  secret_config_ciphertext,
  status_check_kind,
  visible_status,
  last_checked_at,
  last_check_status,
  last_check_error_code,
  last_check_error_message,
  created_at,
  updated_at
)
SELECT
  'sva-mainserver:' || instance_id,
  instance_id,
  'sva_mainserver',
  'host',
  'host',
  'SVA Mainserver',
  'default',
  enabled,
  true,
  'api',
  graphql_base_url,
  'oauth2',
  jsonb_build_object(
    'graphqlBaseUrl', graphql_base_url,
    'oauthTokenUrl', oauth_token_url
  ),
  NULL,
  'sva_mainserver',
  CASE
    WHEN enabled = false THEN 'disabled'
    WHEN last_verified_status = 'ok' THEN 'ok'
    WHEN last_verified_status IS NOT NULL THEN 'error'
    ELSE 'unknown'
  END,
  last_verified_at,
  CASE
    WHEN last_verified_status = 'ok' THEN 'succeeded'
    WHEN last_verified_status IS NOT NULL THEN 'failed'
    ELSE NULL
  END,
  NULL,
  NULL,
  created_at,
  updated_at
FROM iam.instance_integrations
WHERE provider_key = 'sva_mainserver'
  AND NOT EXISTS (
    SELECT 1
    FROM iam.instance_external_interfaces existing
    WHERE existing.instance_id = iam.instance_integrations.instance_id
      AND existing.type_key = 'sva_mainserver'
      AND existing.alias = 'default'
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS instance_external_interfaces_isolation_policy ON iam.instance_external_interfaces;
DROP INDEX IF EXISTS iam.idx_instance_external_interfaces_default_per_type;
DROP INDEX IF EXISTS iam.idx_instance_external_interfaces_instance_type;
DROP TABLE IF EXISTS iam.instance_external_interfaces;
DROP TABLE IF EXISTS iam.external_interface_types;
-- +goose StatementEnd
