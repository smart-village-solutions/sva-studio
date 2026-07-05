-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
    AND role_key = 'system_admin'
),
permission_template(permission_key, action, resource_type, description) AS (
  VALUES
    (
      'iam.accounts.delete',
      'iam.accounts.delete',
      'iam',
      'Delete tenant accounts physically'
    )
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
  permission_template.permission_key,
  permission_template.action,
  permission_template.resource_type,
  NULL,
  'allow',
  '{}'::jsonb,
  permission_template.description
FROM target_instances
CROSS JOIN permission_template
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET
  action = EXCLUDED.action,
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  effect = EXCLUDED.effect,
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
 AND permissions.permission_key = 'iam.accounts.delete'
WHERE roles.role_key = 'system_admin'
  AND roles.instance_id IS NOT NULL
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
    format('0067-up-%s-%s', instance_id, txid_current()),
    'reason',
    'account_delete_permission_migrated'
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
