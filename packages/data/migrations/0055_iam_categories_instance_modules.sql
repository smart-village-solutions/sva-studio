-- +goose Up
-- +goose StatementBegin
INSERT INTO iam.instance_modules (instance_id, module_id)
SELECT DISTINCT
  instance_id,
  'categories'
FROM iam.instance_modules
WHERE module_id IN ('news', 'events', 'poi')
ON CONFLICT (instance_id, module_id) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Non-destructive rollback intentionally omitted because this migration only
-- adds additive instance-module assignments for existing content tenants.
SELECT 1;
-- +goose StatementEnd
