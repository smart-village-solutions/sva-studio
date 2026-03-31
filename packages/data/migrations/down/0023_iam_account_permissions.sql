DROP INDEX IF EXISTS iam.idx_account_permissions_permission;
DROP INDEX IF EXISTS iam.idx_account_permissions_account;

ALTER TABLE IF EXISTS iam.account_permissions
  DROP CONSTRAINT IF EXISTS account_permissions_effect_chk;

DROP TABLE IF EXISTS iam.account_permissions;
