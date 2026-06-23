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
  'map_geocoding',
  'host',
  'host',
  'Map Geocoding',
  'api',
  '{
    "provider":{"type":"string","enum":["geoapify","custom"]},
    "styleUrl":{"type":"string","format":"uri"},
    "autocompleteEnabled":{"type":"boolean"},
    "geocodeEnabled":{"type":"boolean"},
    "reverseGeocodeEnabled":{"type":"boolean"},
    "suggestEndpoint":{"type":"string","format":"uri"},
    "geocodeEndpoint":{"type":"string","format":"uri"},
    "reverseGeocodeEndpoint":{"type":"string","format":"uri"},
    "requestTimeoutMs":{"type":"integer"},
    "rateLimitPerMinute":{"type":"integer"},
    "killSwitchEnabled":{"type":"boolean"}
  }'::jsonb,
  '{"apiKey":{"type":"string"}}'::jsonb,
  'map_geocoding',
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
WHERE type_key = 'map_geocoding';

DELETE FROM iam.external_interface_types
WHERE type_key = 'map_geocoding';
-- +goose StatementEnd
