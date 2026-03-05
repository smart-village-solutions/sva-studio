DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON iam.activity_logs;
DROP FUNCTION IF EXISTS iam.prevent_activity_logs_mutation();

DROP INDEX IF EXISTS idx_activity_logs_account_created;
DROP INDEX IF EXISTS idx_activity_logs_subject_created;
DROP INDEX IF EXISTS idx_accounts_kc_subject_instance;
DROP INDEX IF EXISTS idx_accounts_keycloak_subject;
DROP INDEX IF EXISTS idx_accounts_status;

DO $$
BEGIN
  IF to_regclass('iam.activity_logs') IS NOT NULL THEN
    ALTER TABLE iam.activity_logs
      DROP CONSTRAINT IF EXISTS activity_logs_result_chk,
      DROP COLUMN IF EXISTS result,
      DROP COLUMN IF EXISTS subject_id;
  END IF;

  IF to_regclass('iam.account_roles') IS NOT NULL THEN
    ALTER TABLE iam.account_roles
      DROP CONSTRAINT IF EXISTS account_roles_valid_window_chk,
      DROP COLUMN IF EXISTS valid_to,
      DROP COLUMN IF EXISTS valid_from,
      DROP COLUMN IF EXISTS assigned_by;
  END IF;

  IF to_regclass('iam.accounts') IS NOT NULL THEN
    ALTER TABLE iam.accounts
      DROP CONSTRAINT IF EXISTS accounts_notes_length_chk,
      DROP CONSTRAINT IF EXISTS accounts_status_chk,
      DROP COLUMN IF EXISTS notes,
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS timezone,
      DROP COLUMN IF EXISTS preferred_language,
      DROP COLUMN IF EXISTS avatar_url,
      DROP COLUMN IF EXISTS department,
      DROP COLUMN IF EXISTS position,
      DROP COLUMN IF EXISTS phone_ciphertext,
      DROP COLUMN IF EXISTS last_name_ciphertext,
      DROP COLUMN IF EXISTS first_name_ciphertext,
      DROP COLUMN IF EXISTS instance_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('iam.accounts') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_keycloak_subject_key'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_keycloak_subject_key UNIQUE (keycloak_subject);
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('iam.roles') IS NOT NULL THEN
    ALTER TABLE iam.roles
      DROP CONSTRAINT IF EXISTS roles_role_level_range_chk,
      DROP COLUMN IF EXISTS role_level;
  END IF;

  IF to_regclass('iam.instances') IS NOT NULL THEN
    ALTER TABLE iam.instances
      DROP CONSTRAINT IF EXISTS instances_audit_retention_days_positive_chk,
      DROP CONSTRAINT IF EXISTS instances_retention_days_positive_chk,
      DROP COLUMN IF EXISTS audit_retention_days,
      DROP COLUMN IF EXISTS retention_days;
  END IF;
END
$$;
