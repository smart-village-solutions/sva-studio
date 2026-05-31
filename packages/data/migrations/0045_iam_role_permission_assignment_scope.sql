-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.role_permissions
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'all';

UPDATE iam.role_permissions
SET access_scope = 'all'
WHERE access_scope IS NULL
   OR btrim(access_scope) = '';

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_access_scope_check;

ALTER TABLE iam.role_permissions
  ADD CONSTRAINT role_permissions_access_scope_check
  CHECK (access_scope IN ('all', 'own', 'organization'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_access_scope_check;

ALTER TABLE iam.role_permissions
  DROP COLUMN IF EXISTS access_scope;
-- +goose StatementEnd
