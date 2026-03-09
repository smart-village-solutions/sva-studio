-- Destruktiv: entfernt das komplette IAM-Schema inkl. Daten.
-- Dieser Down-Pfad ist nur für lokale Entwicklung/Tests vorgesehen.
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
DROP TABLE IF EXISTS iam.activity_logs;
DROP TABLE IF EXISTS iam.role_permissions;
DROP TABLE IF EXISTS iam.account_roles;
DROP TABLE IF EXISTS iam.account_organizations;
DROP TABLE IF EXISTS iam.instance_memberships;
DROP TABLE IF EXISTS iam.accounts;
DROP TABLE IF EXISTS iam.permissions;
DROP TABLE IF EXISTS iam.roles;
DROP TABLE IF EXISTS iam.organizations;
DROP TABLE IF EXISTS iam.instances;
DROP FUNCTION IF EXISTS iam.current_instance_id();
ALTER DEFAULT PRIVILEGES IN SCHEMA iam REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam REVOKE USAGE, SELECT ON SEQUENCES FROM iam_app;
DROP SCHEMA IF EXISTS iam;
-- iam_app ist eine clusterweite Rolle und bleibt bewusst bestehen.
