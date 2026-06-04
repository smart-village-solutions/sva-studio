-- +goose Up
-- +goose StatementBegin
WITH touched_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE role_key = 'instance_registry_admin'
     OR (managed_by = 'studio' AND is_system_role = true AND role_key IN (
       'app_manager',
       'feature-manager',
       'interface-manager',
       'designer',
       'editor',
       'moderator'
     ))
  UNION
  SELECT DISTINCT rp.instance_id
  FROM iam.role_permissions rp
  JOIN iam.permissions p
    ON p.instance_id = rp.instance_id
   AND p.id = rp.permission_id
  WHERE p.permission_key = 'instance.registry.manage'
),
legacy_root_roles AS (
  SELECT id, instance_id
  FROM iam.roles
  WHERE role_key = 'instance_registry_admin'
)
DELETE FROM iam.account_roles ar
USING legacy_root_roles lr
WHERE ar.instance_id = lr.instance_id
  AND ar.role_id = lr.id;

WITH legacy_root_roles AS (
  SELECT id, instance_id
  FROM iam.roles
  WHERE role_key = 'instance_registry_admin'
)
DELETE FROM iam.group_roles gr
USING legacy_root_roles lr
WHERE gr.instance_id = lr.instance_id
  AND gr.role_id = lr.id;

DELETE FROM iam.role_permissions rp
USING iam.permissions p
WHERE rp.instance_id = p.instance_id
  AND rp.permission_id = p.id
  AND p.permission_key = 'instance.registry.manage';

UPDATE iam.roles
SET
  description = CASE
    WHEN position('[legacy-root-role-in-tenant]' IN COALESCE(description, '')) > 0 THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN '[legacy-root-role-in-tenant]'
    ELSE description || ' [legacy-root-role-in-tenant]'
  END,
  updated_at = NOW()
WHERE role_key = 'instance_registry_admin';

UPDATE iam.roles
SET
  is_system_role = false,
  description = CASE
    WHEN position('[legacy-bootstrap-role]' IN COALESCE(description, '')) > 0 THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN '[legacy-bootstrap-role]'
    ELSE description || ' [legacy-bootstrap-role]'
  END,
  updated_at = NOW()
WHERE managed_by = 'studio'
  AND is_system_role = true
  AND role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  );

WITH touched_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE role_key = 'instance_registry_admin'
     OR (managed_by = 'studio' AND role_key IN (
       'app_manager',
       'feature-manager',
       'interface-manager',
       'designer',
       'editor',
       'moderator'
     ))
  UNION
  SELECT DISTINCT rp.instance_id
  FROM iam.role_permissions rp
  JOIN iam.permissions p
    ON p.instance_id = rp.instance_id
   AND p.id = rp.permission_id
  WHERE p.permission_key = 'instance.registry.manage'
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0050-up-%s-%s', instance_id, txid_current()),
    'reason',
    'platform_tenant_role_split_migrated'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE iam.roles
SET
  description = NULLIF(
    regexp_replace(COALESCE(description, ''), '\s*\[legacy-root-role-in-tenant\]', '', 'g'),
    ''
  ),
  updated_at = NOW()
WHERE role_key = 'instance_registry_admin';

UPDATE iam.roles
SET
  description = NULLIF(
    regexp_replace(COALESCE(description, ''), '\s*\[legacy-bootstrap-role\]', '', 'g'),
    ''
  ),
  updated_at = NOW()
WHERE managed_by = 'studio'
  AND role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  );

WITH touched_instances AS (
  SELECT DISTINCT instance_id
  FROM iam.roles
  WHERE role_key = 'instance_registry_admin'
     OR (managed_by = 'studio' AND role_key IN (
       'app_manager',
       'feature-manager',
       'interface-manager',
       'designer',
       'editor',
       'moderator'
     ))
)
SELECT pg_notify(
  'iam_permission_snapshot_invalidation',
  json_build_object(
    'instanceId',
    instance_id,
    'eventId',
    format('0050-down-%s-%s', instance_id, txid_current()),
    'reason',
    'platform_tenant_role_split_metadata_rolled_back'
  )::text
)
FROM touched_instances;
-- +goose StatementEnd
