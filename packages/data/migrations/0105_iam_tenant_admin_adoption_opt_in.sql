-- +goose Up
ALTER TABLE iam.instances
  ADD COLUMN tenant_admin_adopt_existing BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE iam.instances
  DROP COLUMN tenant_admin_adopt_existing;
