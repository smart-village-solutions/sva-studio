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
