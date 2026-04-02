-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER NOT NULL DEFAULT 365;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_retention_days_positive_chk'
      AND conrelid = 'iam.instances'::regclass
  ) THEN
    ALTER TABLE iam.instances
      ADD CONSTRAINT instances_retention_days_positive_chk CHECK (retention_days > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_audit_retention_days_positive_chk'
      AND conrelid = 'iam.instances'::regclass
  ) THEN
    ALTER TABLE iam.instances
      ADD CONSTRAINT instances_audit_retention_days_positive_chk CHECK (audit_retention_days > 0);
  END IF;
END
$$;

ALTER TABLE iam.roles
  ADD COLUMN IF NOT EXISTS role_level INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_role_level_range_chk'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_role_level_range_chk CHECK (role_level BETWEEN 0 AND 100);
  END IF;
END
$$;

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES iam.instances(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS first_name_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS last_name_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS phone_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE iam.accounts AS account
SET instance_id = membership.instance_id
FROM (
  SELECT
    account_id,
    (ARRAY_AGG(DISTINCT instance_id))[1] AS instance_id,
    COUNT(DISTINCT instance_id) AS instance_count
  FROM iam.instance_memberships
  GROUP BY account_id
) AS membership
WHERE account.id = membership.account_id
  AND account.instance_id IS NULL
  AND membership.instance_count = 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_status_chk'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_status_chk CHECK (status IN ('pending', 'active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_notes_length_chk'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_notes_length_chk CHECK (char_length(notes) <= 2000);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_keycloak_subject_key'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts DROP CONSTRAINT accounts_keycloak_subject_key;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_accounts_status
  ON iam.accounts(status);

CREATE INDEX IF NOT EXISTS idx_accounts_keycloak_subject
  ON iam.accounts(keycloak_subject);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_kc_subject_instance
  ON iam.accounts(keycloak_subject, instance_id)
  WHERE instance_id IS NOT NULL;

ALTER TABLE iam.account_roles
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_roles_valid_window_chk'
      AND conrelid = 'iam.account_roles'::regclass
  ) THEN
    ALTER TABLE iam.account_roles
      ADD CONSTRAINT account_roles_valid_window_chk CHECK (valid_to IS NULL OR valid_to > valid_from);
  END IF;
END
$$;

ALTER TABLE iam.activity_logs
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_logs_result_chk'
      AND conrelid = 'iam.activity_logs'::regclass
  ) THEN
    ALTER TABLE iam.activity_logs
      ADD CONSTRAINT activity_logs_result_chk CHECK (result IN ('success', 'failure'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_subject_created
  ON iam.activity_logs(instance_id, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_account_created
  ON iam.activity_logs(instance_id, account_id, created_at DESC);

CREATE OR REPLACE FUNCTION iam.prevent_activity_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('iam.retention_mode', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'iam.activity_logs is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON iam.activity_logs;
CREATE TRIGGER trg_immutable_activity_logs
BEFORE UPDATE OR DELETE ON iam.activity_logs
FOR EACH ROW
EXECUTE FUNCTION iam.prevent_activity_logs_mutation();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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
DECLARE
  conflicting_subject TEXT;
BEGIN
  IF to_regclass('iam.accounts') IS NOT NULL THEN
    SELECT a.keycloak_subject
    INTO conflicting_subject
    FROM iam.accounts AS a
    GROUP BY a.keycloak_subject
    HAVING COUNT(*) > 1
    LIMIT 1;

    IF conflicting_subject IS NOT NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'Rollback 0004 kann nicht durchgeführt werden: Mehrfachzuordnung von keycloak_subject erkannt.',
        DETAIL = format('Konflikt bei keycloak_subject=%s', conflicting_subject),
        HINT = 'Vor dem Rollback müssen doppelte keycloak_subject-Werte konsolidiert werden.';
    END IF;
  END IF;

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
-- +goose StatementEnd
