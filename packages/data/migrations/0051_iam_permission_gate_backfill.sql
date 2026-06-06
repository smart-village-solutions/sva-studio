-- +goose Up
-- +goose StatementBegin
WITH target_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE instance_id IS NOT NULL
),
permission_templates(permission_key, action, resource_type, description) AS (
  VALUES
    ('iam.legalText.read', 'iam.legalText.read', 'iam', 'Read legal text administration data'),
    ('iam.legalText.write', 'iam.legalText.write', 'iam', 'Modify legal text administration data'),
    ('iam.governance.read', 'iam.governance.read', 'iam', 'Read governance workflows and audit trails'),
    ('iam.governance.write', 'iam.governance.write', 'iam', 'Execute governance workflows and decisions'),
    ('iam.governance.export', 'iam.governance.export', 'iam', 'Export governance and legal consent evidence'),
    ('iam.dsr.read', 'iam.dsr.read', 'iam', 'Read tenant data-subject-rights cases'),
    ('iam.dsr.write', 'iam.dsr.write', 'iam', 'Process tenant data-subject-rights cases'),
    ('iam.dsr.export', 'iam.dsr.export', 'iam', 'Export tenant data-subject-rights payloads'),
    ('iam.deletionRules.read', 'iam.deletionRules.read', 'iam', 'Read tenant deletion rules'),
    ('iam.deletionRules.write', 'iam.deletionRules.write', 'iam', 'Modify tenant deletion rules'),
    ('iam.monitoring.read', 'iam.monitoring.read', 'iam', 'Read IAM monitoring and plugin operation status'),
    ('iam.monitoring.write', 'iam.monitoring.write', 'iam', 'Run IAM monitoring and plugin operations')
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
    ('system_admin', 'iam.legalText.read'),
    ('system_admin', 'iam.legalText.write'),
    ('system_admin', 'iam.governance.read'),
    ('system_admin', 'iam.governance.write'),
    ('system_admin', 'iam.governance.export'),
    ('system_admin', 'iam.dsr.read'),
    ('system_admin', 'iam.dsr.write'),
    ('system_admin', 'iam.dsr.export'),
    ('system_admin', 'iam.deletionRules.read'),
    ('system_admin', 'iam.deletionRules.write'),
    ('system_admin', 'iam.monitoring.read'),
    ('system_admin', 'iam.monitoring.write'),
    ('iam_admin', 'iam.legalText.read'),
    ('iam_admin', 'iam.legalText.write'),
    ('iam_admin', 'iam.governance.read'),
    ('iam_admin', 'iam.governance.write'),
    ('iam_admin', 'iam.governance.export'),
    ('iam_admin', 'iam.dsr.read'),
    ('iam_admin', 'iam.dsr.write'),
    ('iam_admin', 'iam.dsr.export'),
    ('iam_admin', 'iam.deletionRules.read'),
    ('iam_admin', 'iam.deletionRules.write'),
    ('support_admin', 'iam.governance.read'),
    ('support_admin', 'iam.governance.write'),
    ('support_admin', 'iam.dsr.read'),
    ('support_admin', 'iam.dsr.write'),
    ('support_admin', 'iam.dsr.export'),
    ('security_admin', 'iam.governance.read'),
    ('security_admin', 'iam.governance.export'),
    ('compliance_officer', 'iam.governance.read'),
    ('compliance_officer', 'iam.governance.export')
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
    format('0051-up-%s-%s', instance_id, txid_current()),
    'reason',
    'permission_gate_backfill_migrated'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM iam.role_permissions
USING iam.roles, iam.permissions
WHERE iam.roles.instance_id = iam.role_permissions.instance_id
  AND iam.roles.id = iam.role_permissions.role_id
  AND iam.permissions.instance_id = iam.role_permissions.instance_id
  AND iam.permissions.id = iam.role_permissions.permission_id
  AND iam.roles.role_key IN ('system_admin', 'iam_admin', 'support_admin', 'security_admin', 'compliance_officer')
  AND iam.permissions.permission_key IN (
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

DELETE FROM iam.permissions
WHERE permission_key IN (
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
    format('0051-down-%s-%s', instance_id, txid_current()),
    'reason',
    'permission_gate_backfill_rolled_back'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd
