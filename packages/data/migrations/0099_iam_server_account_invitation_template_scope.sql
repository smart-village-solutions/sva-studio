-- +goose Up
-- +goose StatementBegin
ALTER POLICY server_account_invitation_templates_platform_scope
  ON iam.server_account_invitation_templates
  USING (true)
  WITH CHECK (iam.current_instance_id() IS NULL);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER POLICY server_account_invitation_templates_platform_scope
  ON iam.server_account_invitation_templates
  USING (iam.current_instance_id() IS NULL)
  WITH CHECK (iam.current_instance_id() IS NULL);
-- +goose StatementEnd
