-- +goose Up
ALTER TABLE iam.instances
  ADD COLUMN roleless_redirect_url text;

-- +goose Down
ALTER TABLE iam.instances DROP COLUMN roleless_redirect_url;
