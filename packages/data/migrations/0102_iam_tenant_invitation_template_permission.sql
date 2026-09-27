-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
    AND role_key = 'system_admin'
)
INSERT INTO iam.permissions (
  id, instance_id, permission_key, action, resource_type, resource_id, scope, description
)
SELECT
  gen_random_uuid(), instance_id,
  'iam.invitationTemplate.manage', 'iam.invitationTemplate.manage', 'iam', NULL,
  '{}'::jsonb, 'Manage tenant account invitation template'
FROM target_instances
ON CONFLICT (instance_id, permission_key) DO UPDATE
SET action = EXCLUDED.action,
    resource_type = EXCLUDED.resource_type,
    resource_id = EXCLUDED.resource_id,
    scope = EXCLUDED.scope,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT DISTINCT roles.instance_id, roles.id, permissions.id, 'seed', 'all'
FROM iam.roles roles
JOIN iam.permissions permissions
  ON permissions.instance_id = roles.instance_id
 AND permissions.permission_key = 'iam.invitationTemplate.manage'
WHERE roles.role_key = 'system_admin'
  AND roles.instance_id IS NOT NULL
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId', instance_id,
    'eventId', format('0102-up-%s-%s', instance_id, txid_current()),
    'reason', 'invitation_template_permission_migrated'
  )::text
)
FROM (SELECT DISTINCT instance_id FROM iam.roles WHERE role_key = 'system_admin' AND instance_id IS NOT NULL) touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Existing grants may have been delegated after rollout; rollback is intentionally non-destructive.
SELECT 1;
-- +goose StatementEnd
