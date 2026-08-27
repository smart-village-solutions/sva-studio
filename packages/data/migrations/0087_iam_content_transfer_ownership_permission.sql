-- +goose Up
-- +goose StatementBegin
WITH permission_template(permission_key, action, resource_type, description) AS (
  VALUES (
    'content.transferOwnership',
    'content.transferOwnership',
    'content',
    'Transfer content ownership'
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
 AND permissions.permission_key = 'content.transferOwnership'
WHERE roles.role_key = 'system_admin'
  AND roles.instance_id IS NOT NULL
ON CONFLICT (instance_id, role_id, permission_id) DO UPDATE
SET access_scope = 'all';

WITH bumped_revisions AS (
  INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision, updated_at)
  SELECT instances.id, 2, NOW()
  FROM iam.instances instances
  ON CONFLICT (instance_id) DO UPDATE
  SET
    revision = iam.permission_cache_instance_revisions.revision + 1,
    updated_at = NOW()
  RETURNING instance_id, revision
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'eventId', gen_random_uuid()::text,
    'event', 'PermissionRevisionChanged',
    'instanceId', instance_id,
    'revisionScope', 'instance',
    'newRevision', revision,
    'trigger', 'pg_notify',
    'reason', 'content_transfer_ownership_permission_migrated'
  )::text
)
FROM bumped_revisions;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Non-destructive rollback intentionally omitted because this migration only
-- reconciles the permission row and the system_admin grant for existing tenants.
SELECT 1;
-- +goose StatementEnd
