DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;

CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
