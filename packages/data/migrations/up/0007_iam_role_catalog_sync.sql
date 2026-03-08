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

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_role_key
  ON iam.roles(instance_id, role_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_external_role_name
  ON iam.roles(instance_id, external_role_name);

CREATE INDEX IF NOT EXISTS idx_roles_instance_sync_state
  ON iam.roles(instance_id, sync_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_roles_managed_scope
  ON iam.roles(instance_id, managed_by, external_role_name);
