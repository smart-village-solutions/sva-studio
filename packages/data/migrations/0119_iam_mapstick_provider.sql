-- +goose Up
-- Only provider metadata changes. Tenant assignments are installation-owned runtime provisioning.
UPDATE iam.external_interface_types
SET public_schema_json = jsonb_set(
      public_schema_json,
      '{provider,enum}',
      '["geoapify","custom","mapstick"]'::jsonb
    ),
    updated_at = now()
WHERE type_key = 'map_geocoding';

-- +goose Down
-- Keep the additive provider value: removing it would invalidate existing Mapstick assignments.
SELECT 1;
