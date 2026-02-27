-- Destruktiv: entfernt das komplette IAM-Schema inkl. Daten.
-- Dieser Down-Pfad ist nur für lokale Entwicklung/Tests vorgesehen.
DROP TABLE IF EXISTS iam.activity_logs;
DROP TABLE IF EXISTS iam.role_permissions;
DROP TABLE IF EXISTS iam.account_roles;
DROP TABLE IF EXISTS iam.account_organizations;
DROP TABLE IF EXISTS iam.instance_memberships;
DROP TABLE IF EXISTS iam.permissions;
DROP TABLE IF EXISTS iam.roles;
DROP TABLE IF EXISTS iam.organizations;
DROP TABLE IF EXISTS iam.accounts;
DROP TABLE IF EXISTS iam.instances;
DROP SCHEMA IF EXISTS iam;
