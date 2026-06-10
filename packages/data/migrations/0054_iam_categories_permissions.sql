-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
),
permission_templates(permission_key, action, resource_type, description) AS (
  VALUES
    ('categories.read', 'categories.read', 'categories', 'Read categories plugin content'),
    ('categories.create', 'categories.create', 'categories', 'Create categories plugin content'),
    ('categories.update', 'categories.update', 'categories', 'Update categories plugin content'),
    ('categories.delete', 'categories.delete', 'categories', 'Delete categories plugin content')
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
    ('system_admin', 'categories.read'),
    ('system_admin', 'categories.create'),
    ('system_admin', 'categories.update'),
    ('system_admin', 'categories.delete')
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
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0054-up-%s-%s', instance_id, txid_current()),
    'reason',
    'categories_permissions_migrated'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Non-destructive rollback intentionally omitted because this migration only
-- adds permission rows and default system_admin grants for existing instances.
SELECT 1;
-- +goose StatementEnd
