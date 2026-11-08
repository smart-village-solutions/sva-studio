-- +goose Up
ALTER TABLE iam.instances
  ADD COLUMN login_mfa_desired_mode text NOT NULL DEFAULT 'optional',
  ADD COLUMN login_mfa_applied_mode text,
  ADD COLUMN login_mfa_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN login_mfa_applied_revision integer,
  ADD COLUMN login_mfa_run_id uuid REFERENCES iam.instance_keycloak_provisioning_runs(id),
  ADD CONSTRAINT instances_login_mfa_desired_mode_chk CHECK (login_mfa_desired_mode IN ('optional', 'required')),
  ADD CONSTRAINT instances_login_mfa_applied_mode_chk CHECK (login_mfa_applied_mode IN ('optional', 'required')),
  ADD CONSTRAINT instances_login_mfa_revision_chk CHECK (login_mfa_revision >= 0 AND (login_mfa_applied_revision IS NULL OR login_mfa_applied_revision BETWEEN 0 AND login_mfa_revision));

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
  'iam.authenticationPolicy.manage', 'iam.authenticationPolicy.manage', 'iam', NULL,
  '{}'::jsonb, 'Manage tenant authentication policy'
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
 AND permissions.permission_key = 'iam.authenticationPolicy.manage'
WHERE roles.role_key = 'system_admin'
  AND roles.instance_id IS NOT NULL
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;

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
    'reason', 'authentication_policy_permission_migrated'
  )::text
)
FROM bumped_revisions;
-- +goose StatementEnd


-- +goose Down
-- Keep generic permission/grant records on rollback: removing them would discard later tenant assignments.
ALTER TABLE iam.instances
  DROP COLUMN login_mfa_run_id,
  DROP COLUMN login_mfa_applied_revision,
  DROP COLUMN login_mfa_revision,
  DROP COLUMN login_mfa_applied_mode,
  DROP COLUMN login_mfa_desired_mode;
