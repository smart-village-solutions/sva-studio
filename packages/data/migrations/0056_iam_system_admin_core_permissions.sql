-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
    AND role_key = 'system_admin'
),
permission_templates(permission_key, action, resource_type, description) AS (
  VALUES
    ('iam.user.read', 'iam.user.read', 'iam', 'Read account data'),
    ('iam.user.write', 'iam.user.write', 'iam', 'Modify account data'),
    ('iam.role.read', 'iam.role.read', 'iam', 'Read role assignments'),
    ('iam.role.write', 'iam.role.write', 'iam', 'Modify role assignments'),
    ('iam.org.read', 'iam.org.read', 'iam', 'Read organization data'),
    ('iam.org.write', 'iam.org.write', 'iam', 'Modify organization data')
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
  permission_templates.permission_key,
  permission_templates.action,
  permission_templates.resource_type,
  NULL,
  'allow',
  '{}'::jsonb,
  permission_templates.description
FROM target_instances
CROSS JOIN permission_templates
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

WITH role_permission_templates(role_key, permission_key) AS (
  VALUES
    ('system_admin', 'iam.user.read'),
    ('system_admin', 'iam.user.write'),
    ('system_admin', 'iam.role.read'),
    ('system_admin', 'iam.role.write'),
    ('system_admin', 'iam.org.read'),
    ('system_admin', 'iam.org.write')
)
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT DISTINCT
  roles.instance_id,
  roles.id,
  permissions.id,
  'seed',
  'all'
FROM role_permission_templates
JOIN iam.roles roles
  ON roles.role_key = role_permission_templates.role_key
 AND roles.instance_id IS NOT NULL
JOIN iam.permissions permissions
  ON permissions.instance_id = roles.instance_id
 AND permissions.permission_key = role_permission_templates.permission_key
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

WITH touched_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
    AND role_key = 'system_admin'
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0056-up-%s-%s', instance_id, txid_current()),
    'reason',
    'system_admin_core_permissions_migrated'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Non-destructive rollback intentionally omitted because this migration only
-- restores missing permission rows and system_admin grants for existing tenants.
SELECT 1;
-- +goose StatementEnd
