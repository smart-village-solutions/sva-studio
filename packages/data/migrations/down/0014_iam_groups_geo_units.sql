DROP POLICY IF EXISTS geo_units_isolation_policy ON iam.geo_units;
DROP POLICY IF EXISTS account_groups_isolation_policy ON iam.account_groups;
DROP POLICY IF EXISTS group_roles_isolation_policy ON iam.group_roles;
DROP POLICY IF EXISTS groups_isolation_policy ON iam.groups;

DROP TABLE IF EXISTS iam.geo_units;
DROP TABLE IF EXISTS iam.account_groups;
DROP TABLE IF EXISTS iam.group_roles;
DROP TABLE IF EXISTS iam.groups;
