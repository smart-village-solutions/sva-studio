-- +goose Up
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
VALUES (
  'postgresql',
  'host',
  'host',
  'PostgreSQL',
  'database',
  '{"schemaName":{"type":"string"}}'::jsonb,
  '{"databaseUrl":{"type":"string"}}'::jsonb,
  'postgresql',
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

-- +goose Down
DELETE FROM iam.external_interface_types
WHERE type_key = 'postgresql'
  AND NOT EXISTS (
    SELECT 1
    FROM iam.instance_external_interfaces
    WHERE type_key = 'postgresql'
  );
