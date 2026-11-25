-- +goose Up
INSERT INTO iam.external_interface_types (
  type_key, owner_kind, owner_id, display_name, category, public_schema_json,
  secret_schema_json, status_check_kind
)
VALUES (
  'meilisearch', 'host', 'host', 'Meilisearch', 'api',
  '{"origin":{"type":"string"},"environment":{"type":"string"},"municipalityIds":{"type":"string"},"graphqlBaseUrl":{"type":"string"}}',
  '{"apiKey":{"type":"string"}}', 'meilisearch'
);

CREATE UNIQUE INDEX idx_instance_meilisearch_interface
  ON iam.instance_external_interfaces (instance_id)
  WHERE type_key = 'meilisearch';

-- +goose Down
-- The foreign key deliberately blocks rollback while configured interfaces exist.
DELETE FROM iam.external_interface_types WHERE type_key = 'meilisearch';
DROP INDEX iam.idx_instance_meilisearch_interface;
