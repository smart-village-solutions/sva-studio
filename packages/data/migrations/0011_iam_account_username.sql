-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS username_ciphertext TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.accounts
  DROP COLUMN IF EXISTS username_ciphertext;
-- +goose StatementEnd
