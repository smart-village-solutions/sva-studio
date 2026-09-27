-- +goose Up
-- +goose StatementBegin
-- Standalone installations run migrations without the separate app-role bootstrap.
-- The app role is NOINHERIT, so iam_app's default table grant is insufficient.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva_app') THEN
    GRANT SELECT, UPDATE ON iam.server_account_invitation_templates TO sva_app;
  END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Intentionally retain the grant: older bootstrap jobs may already have granted
-- the same privileges, so revoking them would remove pre-existing access.
SELECT 1;
-- +goose StatementEnd
