-- +goose Up
-- +goose StatementBegin
CREATE TEMP TABLE migration_0053_touched_instances ON COMMIT DROP AS
SELECT DISTINCT role_permissions.instance_id
FROM iam.role_permissions role_permissions
JOIN iam.roles roles
  ON roles.instance_id = role_permissions.instance_id
 AND roles.id = role_permissions.role_id
JOIN iam.permissions permissions
  ON permissions.instance_id = role_permissions.instance_id
 AND permissions.id = role_permissions.permission_id
WHERE roles.instance_id IS NOT NULL
  AND roles.role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  )
  AND role_permissions.grant_origin_kind = 'seed'
  AND permissions.permission_key IN (
    'app.read',
    'cockpit.read',
    'experimental.read',
    'iam.legalText.read',
    'iam.legalText.write',
    'iam.governance.read',
    'iam.governance.write',
    'iam.governance.export',
    'iam.dsr.read',
    'iam.dsr.write',
    'iam.dsr.export',
    'iam.deletionRules.read',
    'iam.deletionRules.write',
    'iam.monitoring.read',
    'iam.monitoring.write'
  );

DELETE FROM iam.role_permissions
USING iam.roles, iam.permissions
WHERE iam.roles.instance_id = iam.role_permissions.instance_id
  AND iam.roles.id = iam.role_permissions.role_id
  AND iam.permissions.instance_id = iam.role_permissions.instance_id
  AND iam.permissions.id = iam.role_permissions.permission_id
  AND iam.roles.instance_id IS NOT NULL
  AND iam.roles.role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  )
  AND iam.role_permissions.grant_origin_kind = 'seed'
  AND iam.permissions.permission_key IN (
    'app.read',
    'cockpit.read',
    'experimental.read',
    'iam.legalText.read',
    'iam.legalText.write',
    'iam.governance.read',
    'iam.governance.write',
    'iam.governance.export',
    'iam.dsr.read',
    'iam.dsr.write',
    'iam.dsr.export',
    'iam.deletionRules.read',
    'iam.deletionRules.write',
    'iam.monitoring.read',
    'iam.monitoring.write'
  );

SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0053-up-%s-%s', instance_id, txid_current()),
    'reason',
    'legacy_standard_role_grants_cleaned'
  )::text
)
FROM migration_0053_touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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
WHERE roles.instance_id IS NOT NULL
  AND roles.role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  )
  AND permissions.permission_key IN (
    'app.read',
    'cockpit.read',
    'experimental.read',
    'iam.legalText.read',
    'iam.legalText.write',
    'iam.governance.read',
    'iam.governance.write',
    'iam.governance.export',
    'iam.dsr.read',
    'iam.dsr.write',
    'iam.dsr.export',
    'iam.deletionRules.read',
    'iam.deletionRules.write',
    'iam.monitoring.read',
    'iam.monitoring.write'
  )
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

WITH touched_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
    AND role_key IN (
      'app_manager',
      'feature-manager',
      'interface-manager',
      'designer',
      'editor',
      'moderator'
    )
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0053-down-%s-%s', instance_id, txid_current()),
    'reason',
    'legacy_standard_role_grants_restored'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd
