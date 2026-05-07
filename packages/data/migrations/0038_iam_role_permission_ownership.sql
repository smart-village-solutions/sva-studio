-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.role_permissions
  ADD COLUMN IF NOT EXISTS grant_origin_kind TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS grant_origin_module_id TEXT;

UPDATE iam.role_permissions
SET
  grant_origin_kind = COALESCE(NULLIF(grant_origin_kind, ''), 'manual'),
  grant_origin_module_id = NULL
WHERE grant_origin_kind IS NULL
   OR grant_origin_kind = '';

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_grant_origin_kind_check;

ALTER TABLE iam.role_permissions
  ADD CONSTRAINT role_permissions_grant_origin_kind_check
  CHECK (grant_origin_kind IN ('manual', 'seed', 'bootstrap', 'module_sync'));

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_grant_origin_module_check;

ALTER TABLE iam.role_permissions
  ADD CONSTRAINT role_permissions_grant_origin_module_check
  CHECK (
    (
      grant_origin_kind = 'module_sync'
      AND grant_origin_module_id IS NOT NULL
      AND btrim(grant_origin_module_id) <> ''
    )
    OR (
      grant_origin_kind <> 'module_sync'
      AND grant_origin_module_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_role_permissions_origin_module
  ON iam.role_permissions(instance_id, grant_origin_kind, grant_origin_module_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_role_permissions_origin_module;

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_grant_origin_module_check;

ALTER TABLE iam.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_grant_origin_kind_check;

ALTER TABLE iam.role_permissions
  DROP COLUMN IF EXISTS grant_origin_module_id,
  DROP COLUMN IF EXISTS grant_origin_kind;
-- +goose StatementEnd
