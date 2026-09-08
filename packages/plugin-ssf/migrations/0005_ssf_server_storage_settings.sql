-- +goose Up
-- +goose StatementBegin
ALTER TABLE ssf.server_settings
  ADD COLUMN conversation_content_storage_allowed boolean,
  ADD COLUMN conversation_content_storage_mode varchar(16),
  ADD CONSTRAINT server_settings_storage_mode_check CHECK (
    conversation_content_storage_mode IS NULL
    OR conversation_content_storage_mode IN ('ask', 'disabled')
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE ssf.server_settings
  DROP CONSTRAINT IF EXISTS server_settings_storage_mode_check,
  DROP COLUMN IF EXISTS conversation_content_storage_mode,
  DROP COLUMN IF EXISTS conversation_content_storage_allowed;
-- +goose StatementEnd
