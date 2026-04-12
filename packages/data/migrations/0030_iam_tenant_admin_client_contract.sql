-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS tenant_admin_client_id TEXT,
  ADD COLUMN IF NOT EXISTS tenant_admin_client_secret_ciphertext TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.instances
  DROP COLUMN IF EXISTS tenant_admin_client_secret_ciphertext,
  DROP COLUMN IF EXISTS tenant_admin_client_id;
-- +goose StatementEnd
