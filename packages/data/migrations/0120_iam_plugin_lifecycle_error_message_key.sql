-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_plugin_lifecycle
  ADD COLUMN error_message_key TEXT;

ALTER TABLE iam.instance_plugin_lifecycle
  ADD CONSTRAINT instance_plugin_lifecycle_error_message_key_chk
    CHECK (
      error_message_key IS NULL
      OR (
        error_code IS NOT NULL
        AND char_length(error_message_key) <= 160
        AND error_message_key ~ '^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$'
      )
    );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instance_plugin_lifecycle
  DROP CONSTRAINT IF EXISTS instance_plugin_lifecycle_error_message_key_chk;
ALTER TABLE iam.instance_plugin_lifecycle
  DROP COLUMN IF EXISTS error_message_key;
-- +goose StatementEnd
