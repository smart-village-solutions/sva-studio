-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ALTER COLUMN tenant_admin_client_id SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  ALTER COLUMN tenant_admin_client_id DROP NOT NULL;
-- +goose StatementEnd
