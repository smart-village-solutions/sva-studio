-- +goose Up
-- +goose StatementBegin
WITH permission_template(permission_key, action, resource_type, description) AS (
  VALUES
    (
      'modules.read',
      'modules.read',
      'modules',
      'Show the modules overview in the Studio'
    )
)
INSERT INTO iam.permissions (
  id,
  instance_id,
  permission_key,
  action,
  resource_type,
  resource_id,
  scope,
  description
)
SELECT
  gen_random_uuid(),
  instances.id,
  permission_template.permission_key,
  permission_template.action,
  permission_template.resource_type,
  NULL,
  '{}'::jsonb,
  permission_template.description
FROM iam.instances instances
CROSS JOIN permission_template
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT DISTINCT
  roles.instance_id,
  roles.id,
  permissions.id,
  'seed',
  'all'
FROM iam.roles roles
JOIN iam.permissions permissions
  ON permissions.instance_id = roles.instance_id
 AND permissions.permission_key = 'modules.read'
WHERE roles.role_key = 'system_admin'
  AND roles.instance_id IS NOT NULL
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instances.id,
    'eventId',
    format('0080-up-%s-%s', instances.id, txid_current()),
    'reason',
    'modules_read_permission_migrated'
  )::text
)
FROM iam.instances instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Non-destructive rollback intentionally omitted because this migration only
-- restores a missing permission row and system_admin grant for existing tenants.
SELECT 1;
-- +goose StatementEnd
