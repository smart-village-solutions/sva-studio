-- +goose Up
-- +goose StatementBegin
WITH instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key IN ('content.read', 'content.create', 'content.update', 'content.publish', 'content.moderate')
),
permission_templates(permission_key, action, description) AS (
  VALUES
    ('content.updateMetadata', 'content.updateMetadata', 'Update content metadata'),
    ('content.updatePayload', 'content.updatePayload', 'Update content payload'),
    ('content.changeStatus', 'content.changeStatus', 'Change content status'),
    ('content.archive', 'content.archive', 'Archive content'),
    ('content.restore', 'content.restore', 'Restore content'),
    ('content.readHistory', 'content.readHistory', 'Read content history'),
    ('content.manageRevisions', 'content.manageRevisions', 'Manage content revisions'),
    ('content.delete', 'content.delete', 'Delete content')
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
  instances.instance_id,
  permission_templates.permission_key,
  permission_templates.action,
  'content',
  NULL,
  'allow',
  '{}'::jsonb,
  permission_templates.description
FROM instances
CROSS JOIN permission_templates
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT DISTINCT old_assignment.instance_id, old_assignment.role_id, new_permission.id
FROM iam.role_permissions old_assignment
JOIN iam.permissions old_permission
  ON old_permission.instance_id = old_assignment.instance_id
 AND old_permission.id = old_assignment.permission_id
JOIN iam.permissions new_permission
  ON new_permission.instance_id = old_assignment.instance_id
 AND new_permission.permission_key IN ('content.updateMetadata', 'content.updatePayload', 'content.changeStatus')
WHERE old_permission.permission_key = 'content.update'
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT DISTINCT old_assignment.instance_id, old_assignment.role_id, new_permission.id
FROM iam.role_permissions old_assignment
JOIN iam.permissions old_permission
  ON old_permission.instance_id = old_assignment.instance_id
 AND old_permission.id = old_assignment.permission_id
JOIN iam.permissions new_permission
  ON new_permission.instance_id = old_assignment.instance_id
 AND new_permission.permission_key = 'content.readHistory'
WHERE old_permission.permission_key = 'content.read'
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT DISTINCT old_assignment.instance_id, old_assignment.role_id, new_permission.id
FROM iam.role_permissions old_assignment
JOIN iam.permissions old_permission
  ON old_permission.instance_id = old_assignment.instance_id
 AND old_permission.id = old_assignment.permission_id
JOIN iam.permissions new_permission
  ON new_permission.instance_id = old_assignment.instance_id
 AND new_permission.permission_key IN ('content.manageRevisions', 'content.archive', 'content.restore')
WHERE old_permission.permission_key = 'content.moderate'
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

DELETE FROM iam.permissions
WHERE permission_key IN ('content.update', 'content.moderate');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
WITH instances AS (
  SELECT DISTINCT instance_id
  FROM iam.permissions
  WHERE permission_key LIKE 'content.%'
),
permission_templates(permission_key, action, description) AS (
  VALUES
    ('content.update', 'content.update', 'Update content'),
    ('content.moderate', 'content.moderate', 'Moderate content')
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
  instances.instance_id,
  permission_templates.permission_key,
  permission_templates.action,
  'content',
  NULL,
  'allow',
  '{}'::jsonb,
  permission_templates.description
FROM instances
CROSS JOIN permission_templates
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  effect = EXCLUDED.effect,
  scope = EXCLUDED.scope,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT DISTINCT new_assignment.instance_id, new_assignment.role_id, legacy_permission.id
FROM iam.role_permissions new_assignment
JOIN iam.permissions new_permission
  ON new_permission.instance_id = new_assignment.instance_id
 AND new_permission.id = new_assignment.permission_id
JOIN iam.permissions legacy_permission
  ON legacy_permission.instance_id = new_assignment.instance_id
 AND legacy_permission.permission_key = 'content.update'
WHERE new_permission.permission_key IN ('content.updateMetadata', 'content.updatePayload', 'content.changeStatus')
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT DISTINCT new_assignment.instance_id, new_assignment.role_id, legacy_permission.id
FROM iam.role_permissions new_assignment
JOIN iam.permissions new_permission
  ON new_permission.instance_id = new_assignment.instance_id
 AND new_permission.id = new_assignment.permission_id
JOIN iam.permissions legacy_permission
  ON legacy_permission.instance_id = new_assignment.instance_id
 AND legacy_permission.permission_key = 'content.moderate'
WHERE new_permission.permission_key IN ('content.manageRevisions', 'content.archive', 'content.restore')
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

DELETE FROM iam.permissions
WHERE permission_key IN (
  'content.updateMetadata',
  'content.updatePayload',
  'content.changeStatus',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.manageRevisions',
  'content.delete'
);
-- +goose StatementEnd
