-- +goose Up
-- +goose StatementBegin
ALTER TABLE ssf.server_settings
  ADD COLUMN installation_content_v2 jsonb,
  ADD COLUMN runtime_content_v2 jsonb,
  ADD CONSTRAINT server_settings_installation_content_v2_object_check CHECK (
    installation_content_v2 IS NULL OR jsonb_typeof(installation_content_v2) = 'object'
  ),
  ADD CONSTRAINT server_settings_runtime_content_v2_object_check CHECK (
    runtime_content_v2 IS NULL OR jsonb_typeof(runtime_content_v2) = 'object'
  );

ALTER TABLE ssf.tenant_settings
  ADD COLUMN runtime_content_v2 jsonb,
  ADD CONSTRAINT tenant_settings_runtime_content_v2_object_check CHECK (
    runtime_content_v2 IS NULL OR jsonb_typeof(runtime_content_v2) = 'object'
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE ssf.tenant_settings
  DROP CONSTRAINT tenant_settings_runtime_content_v2_object_check,
  DROP COLUMN runtime_content_v2;

ALTER TABLE ssf.server_settings
  DROP CONSTRAINT server_settings_runtime_content_v2_object_check,
  DROP CONSTRAINT server_settings_installation_content_v2_object_check,
  DROP COLUMN runtime_content_v2,
  DROP COLUMN installation_content_v2;
-- +goose StatementEnd
