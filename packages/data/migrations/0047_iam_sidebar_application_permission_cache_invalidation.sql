-- +goose Up
-- +goose StatementBegin
WITH relevant_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key IN ('app.read', 'cockpit.read')
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0047-up-%s-%s', instance_id, txid_current()),
    'reason',
    'sidebar_application_permissions_migrated'
  )::text
)
FROM relevant_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
WITH relevant_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key IN ('app.read', 'cockpit.read')
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0047-down-%s-%s', instance_id, txid_current()),
    'reason',
    'sidebar_application_permissions_rolled_back'
  )::text
)
FROM relevant_instances;
-- +goose StatementEnd
