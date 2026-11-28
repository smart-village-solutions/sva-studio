-- +goose Up
INSERT INTO iam.external_interface_types (
  type_key, owner_kind, owner_id, display_name, category, public_schema_json,
  secret_schema_json, status_check_kind
)
VALUES (
  'ssf_translation', 'host', 'host', 'Smart Speech Flow', 'api',
  '{"origin":{"type":"string"},"selectedLocales":{"type":"array"}}',
  '{"apiKey":{"type":"string"}}', 'ssf_translation'
);

CREATE UNIQUE INDEX idx_instance_ssf_translation_interface
  ON iam.instance_external_interfaces (instance_id)
  WHERE type_key = 'ssf_translation';

-- +goose Down
-- Retain tenant credentials by requiring removal of configured records before rollback.
DELETE FROM iam.external_interface_types WHERE type_key = 'ssf_translation';
DROP INDEX iam.idx_instance_ssf_translation_interface;
