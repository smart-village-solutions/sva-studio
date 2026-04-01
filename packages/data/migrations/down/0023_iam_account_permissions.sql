DROP INDEX IF EXISTS iam.idx_account_permissions_permission;
DROP INDEX IF EXISTS iam.idx_account_permissions_account;
DROP INDEX IF EXISTS iam.idx_account_permissions_instance_permission;
DROP INDEX IF EXISTS iam.idx_account_permissions_instance_account;

DROP POLICY IF EXISTS account_permissions_isolation_policy ON iam.account_permissions;

ALTER TABLE IF EXISTS iam.account_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS iam.account_permissions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS iam.account_permissions
  DROP CONSTRAINT IF EXISTS account_permissions_effect_chk;
DROP TABLE IF EXISTS iam.account_permissions;
