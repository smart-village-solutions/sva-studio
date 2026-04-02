-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.roles
  ADD COLUMN IF NOT EXISTS role_key TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS external_role_name TEXT,
  ADD COLUMN IF NOT EXISTS managed_by TEXT,
  ADD COLUMN IF NOT EXISTS sync_state TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

UPDATE iam.roles
SET
  role_key = COALESCE(role_key, role_name),
  display_name = COALESCE(display_name, role_name),
  external_role_name = COALESCE(external_role_name, role_name),
  managed_by = COALESCE(managed_by, 'studio'),
  sync_state = COALESCE(sync_state, 'pending')
WHERE
  role_key IS NULL
  OR display_name IS NULL
  OR external_role_name IS NULL
  OR managed_by IS NULL
  OR sync_state IS NULL;

ALTER TABLE iam.roles
  ALTER COLUMN role_key SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN external_role_name SET NOT NULL,
  ALTER COLUMN managed_by SET NOT NULL,
  ALTER COLUMN managed_by SET DEFAULT 'studio',
  ALTER COLUMN sync_state SET NOT NULL,
  ALTER COLUMN sync_state SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_sync_state_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_sync_state_chk CHECK (sync_state IN ('synced', 'pending', 'failed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_managed_by_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_managed_by_chk CHECK (managed_by IN ('studio', 'external'));
  END IF;
END
$$;

ALTER TABLE iam.roles
  DROP CONSTRAINT IF EXISTS roles_instance_name_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_role_key
  ON iam.roles(instance_id, role_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_external_role_name
  ON iam.roles(instance_id, external_role_name);

CREATE INDEX IF NOT EXISTS idx_roles_instance_sync_state
  ON iam.roles(instance_id, sync_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_roles_managed_scope
  ON iam.roles(instance_id, managed_by, external_role_name);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_roles_managed_scope;
DROP INDEX IF EXISTS idx_roles_instance_sync_state;
DROP INDEX IF EXISTS uq_roles_instance_external_role_name;
DROP INDEX IF EXISTS uq_roles_instance_role_key;

ALTER TABLE iam.roles
  DROP CONSTRAINT IF EXISTS roles_managed_by_chk,
  DROP CONSTRAINT IF EXISTS roles_sync_state_chk;

ALTER TABLE iam.roles
  DROP COLUMN IF EXISTS last_error_code,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS sync_state,
  DROP COLUMN IF EXISTS managed_by,
  DROP COLUMN IF EXISTS external_role_name,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS role_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT instance_id, role_name
      FROM iam.roles
      GROUP BY instance_id, role_name
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION
      'Rollback 0007 blocked: duplicate (instance_id, role_name) rows exist. Clean duplicates before restoring roles_instance_name_uniq.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_instance_name_uniq'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_instance_name_uniq UNIQUE (instance_id, role_name);
  END IF;
END
$$;
-- +goose StatementEnd
