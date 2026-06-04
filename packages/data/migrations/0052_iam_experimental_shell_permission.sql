-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
)
INSERT INTO iam.permissions (
  id,
  instance_id,
  permission_key,
  action,
  resource_type,
  resource_id,
  effect,
  scope,
  description
)
SELECT
  gen_random_uuid(),
  target_instances.instance_id,
  'experimental.read',
  'experimental.read',
  'experimental',
  NULL,
  'allow',
  '{}'::jsonb,
  'Enable experimental shell features and placeholders'
FROM target_instances
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

WITH source_role_permissions AS (
  SELECT DISTINCT
    role_permissions.instance_id,
    role_permissions.role_id
  FROM iam.role_permissions role_permissions
  JOIN iam.permissions permissions
    ON permissions.instance_id = role_permissions.instance_id
   AND permissions.id = role_permissions.permission_id
  WHERE permissions.permission_key IN ('app.read', 'cockpit.read', 'iam.monitoring.read', 'feature.toggle')
),
experimental_permissions AS (
  SELECT instance_id, id
  FROM iam.permissions
  WHERE permission_key = 'experimental.read'
)
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT
  source_role_permissions.instance_id,
  source_role_permissions.role_id,
  experimental_permissions.id,
  'seed',
  'all'
FROM source_role_permissions
JOIN experimental_permissions
  ON experimental_permissions.instance_id = source_role_permissions.instance_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

WITH relevant_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key IN ('experimental.read', 'app.read', 'cockpit.read', 'iam.monitoring.read')
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0052-up-%s-%s', instance_id, txid_current()),
    'reason',
    'experimental_shell_permission_migrated'
  )::text
)
FROM relevant_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM iam.role_permissions
USING iam.permissions
WHERE iam.permissions.instance_id = iam.role_permissions.instance_id
  AND iam.permissions.id = iam.role_permissions.permission_id
  AND iam.permissions.permission_key = 'experimental.read';

DELETE FROM iam.permissions
WHERE permission_key = 'experimental.read';

WITH relevant_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key IN ('app.read', 'cockpit.read', 'iam.monitoring.read')
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0052-down-%s-%s', instance_id, txid_current()),
    'reason',
    'experimental_shell_permission_rolled_back'
  )::text
)
FROM relevant_instances;
-- +goose StatementEnd
