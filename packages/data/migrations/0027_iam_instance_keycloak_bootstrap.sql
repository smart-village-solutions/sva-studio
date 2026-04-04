-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS auth_client_secret_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS tenant_admin_username TEXT,
  ADD COLUMN IF NOT EXISTS tenant_admin_email TEXT,
  ADD COLUMN IF NOT EXISTS tenant_admin_first_name TEXT,
  ADD COLUMN IF NOT EXISTS tenant_admin_last_name TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.instances
  DROP COLUMN IF EXISTS tenant_admin_last_name,
  DROP COLUMN IF EXISTS tenant_admin_first_name,
  DROP COLUMN IF EXISTS tenant_admin_email,
  DROP COLUMN IF EXISTS tenant_admin_username,
  DROP COLUMN IF EXISTS auth_client_secret_ciphertext;
-- +goose StatementEnd
