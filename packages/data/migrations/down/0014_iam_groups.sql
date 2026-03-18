DROP POLICY IF EXISTS account_groups_isolation_policy ON iam.account_groups;
DROP POLICY IF EXISTS group_roles_isolation_policy ON iam.group_roles;
DROP POLICY IF EXISTS groups_isolation_policy ON iam.groups;

DROP INDEX IF EXISTS iam.idx_group_roles_group;
DROP INDEX IF EXISTS iam.idx_account_groups_group;
DROP INDEX IF EXISTS iam.idx_account_groups_account;
DROP INDEX IF EXISTS iam.uq_groups_instance_id_id;

DROP TABLE IF EXISTS iam.account_groups;
DROP TABLE IF EXISTS iam.group_roles;
DROP TABLE IF EXISTS iam.groups;
