DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (
    EXISTS (
      SELECT 1
      FROM iam.instance_memberships membership
      WHERE membership.account_id = iam.accounts.id
        AND membership.instance_id = iam.current_instance_id()
    )
  )
  WITH CHECK (iam.current_instance_id() IS NOT NULL);

DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
