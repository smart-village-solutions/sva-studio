-- +goose Up
-- +goose StatementBegin
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
  'mail_transport',
  'host',
  'host',
  'Mail Transport',
  'api',
  '{
    "transportId":{"type":"string"},
    "transportType":{"type":"string","enum":["smtp","provider_api"]},
    "host":{"type":"string"},
    "port":{"type":"integer"},
    "endpoint":{"type":"string","format":"uri"},
    "mode":{"type":"string"},
    "securityMode":{"type":"string","enum":["none","starttls","tls"]},
    "authMode":{"type":"string","enum":["none","basic"]},
    "username":{"type":"string"},
    "secretRef":{"type":"string"},
    "defaultFromEmail":{"type":"string","format":"email"},
    "defaultFromName":{"type":"string"},
    "defaultReplyToEmail":{"type":"string","format":"email"},
    "maxBatchSize":{"type":"integer"},
    "rateLimitPerMinute":{"type":"integer"}
  }'::jsonb,
  '{}'::jsonb,
  'mail_transport',
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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM iam.instance_external_interfaces
WHERE type_key = 'mail_transport';

DELETE FROM iam.external_interface_types
WHERE type_key = 'mail_transport';
-- +goose StatementEnd
