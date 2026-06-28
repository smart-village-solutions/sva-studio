-- +goose Up
-- +goose StatementBegin
-- Older local and long-lived databases can still carry the pre-scope primary key.
-- The canonical identity is content_list_projection_scope_key, because the same
-- Mainserver entity may be materialized for multiple organization/user scopes.
ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_pkey;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Re-adding the legacy primary key would be destructive once scope-specific
-- projection rows exist, so rollback is intentionally omitted.
-- +goose StatementEnd
