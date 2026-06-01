-- +goose Up
-- +goose StatementBegin
WITH target_roles AS (
  SELECT id, instance_id, role_key
  FROM iam.roles
  WHERE role_key IN ('system_admin', 'instance_registry_admin', 'app_manager', 'feature-manager', 'interface-manager', 'designer', 'editor', 'moderator')
),
target_instances AS (
  SELECT DISTINCT instance_id
  FROM target_roles
),
permission_templates(permission_key, action, resource_type, description) AS (
  VALUES
    ('app.read', 'app.read', 'app', 'Show the app link in the sidebar'),
    ('cockpit.read', 'cockpit.read', 'cockpit', 'Show the cockpit link in the sidebar')
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

WITH target_roles AS (
  SELECT id, instance_id, role_key
  FROM iam.roles
  WHERE role_key IN ('system_admin', 'instance_registry_admin', 'app_manager', 'feature-manager', 'interface-manager', 'designer', 'editor', 'moderator')
)
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT DISTINCT
  target_roles.instance_id,
  target_roles.id,
  permissions.id,
  'seed',
  'all'
FROM target_roles
JOIN iam.permissions permissions
  ON permissions.instance_id = target_roles.instance_id
 AND permissions.permission_key IN ('app.read', 'cockpit.read')
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM iam.role_permissions
USING iam.roles, iam.permissions
WHERE iam.roles.instance_id = iam.role_permissions.instance_id
  AND iam.roles.id = iam.role_permissions.role_id
  AND iam.permissions.instance_id = iam.role_permissions.instance_id
  AND iam.permissions.id = iam.role_permissions.permission_id
  AND iam.roles.role_key IN ('system_admin', 'instance_registry_admin', 'app_manager', 'feature-manager', 'interface-manager', 'designer', 'editor', 'moderator')
  AND iam.permissions.permission_key IN ('app.read', 'cockpit.read');

DELETE FROM iam.permissions
WHERE permission_key IN ('app.read', 'cockpit.read');
-- +goose StatementEnd
