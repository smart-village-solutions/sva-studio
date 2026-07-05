-- +goose Up
-- +goose StatementBegin
-- Immutable Audit-Logs dürfen harte Tenant-Account-Löschungen nicht mehr per FK-Nullung blockieren.
ALTER TABLE iam.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_account_id_fkey,
  DROP CONSTRAINT IF EXISTS activity_logs_subject_id_fkey;

ALTER TABLE iam.platform_activity_logs
  DROP CONSTRAINT IF EXISTS platform_activity_logs_account_id_fkey;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.activity_logs AS logs
    LEFT JOIN iam.accounts AS actor_account
      ON actor_account.id = logs.account_id
    LEFT JOIN iam.accounts AS subject_account
      ON subject_account.id = logs.subject_id
    WHERE (logs.account_id IS NOT NULL AND actor_account.id IS NULL)
       OR (logs.subject_id IS NOT NULL AND subject_account.id IS NULL)
  ) OR EXISTS (
    SELECT 1
    FROM iam.platform_activity_logs AS logs
    LEFT JOIN iam.accounts AS actor_account
      ON actor_account.id = logs.account_id
    WHERE logs.account_id IS NOT NULL
      AND actor_account.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore activity log account foreign keys while orphaned audit references exist.';
  END IF;
END $$;

ALTER TABLE iam.activity_logs
  ADD CONSTRAINT activity_logs_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL,
  ADD CONSTRAINT activity_logs_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;

ALTER TABLE iam.platform_activity_logs
  ADD CONSTRAINT platform_activity_logs_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES iam.accounts(id) ON DELETE SET NULL;
-- +goose StatementEnd
