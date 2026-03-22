ALTER TABLE iam.account_groups
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_origin_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_origin_chk
      CHECK (origin IN ('manual', 'seed', 'sync'));
  END IF;
END
$$;
