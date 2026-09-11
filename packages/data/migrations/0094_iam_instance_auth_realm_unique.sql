-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD CONSTRAINT instances_auth_realm_unique UNIQUE (auth_realm);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  DROP CONSTRAINT instances_auth_realm_unique;
-- +goose StatementEnd
