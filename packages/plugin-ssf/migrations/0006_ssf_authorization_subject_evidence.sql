-- +goose Up
-- +goose StatementBegin
ALTER TABLE ssf.authorization_projections
  ADD COLUMN confirmed_has_subjects boolean GENERATED ALWAYS AS (
    COALESCE(jsonb_array_length(confirmed_projection -> 'subjects') > 0, false)
  ) STORED;

GRANT SELECT (confirmed_has_subjects)
  ON ssf.authorization_projections TO ssf_plugin_tenant_runtime;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE ssf.authorization_projections
  DROP COLUMN confirmed_has_subjects;
-- +goose StatementEnd
