ALTER TABLE iam.account_groups
  DROP CONSTRAINT IF EXISTS account_groups_origin_chk;

ALTER TABLE iam.account_groups
  DROP COLUMN IF EXISTS origin;
