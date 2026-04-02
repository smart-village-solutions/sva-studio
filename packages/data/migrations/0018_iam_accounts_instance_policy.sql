-- +goose Up
-- +goose StatementBegin
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;

CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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
-- +goose StatementEnd
