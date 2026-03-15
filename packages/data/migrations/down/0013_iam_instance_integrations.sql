DROP POLICY IF EXISTS instance_integrations_isolation_policy ON iam.instance_integrations;
DROP INDEX IF EXISTS iam.idx_instance_integrations_instance_provider;
DROP TABLE IF EXISTS iam.instance_integrations;
