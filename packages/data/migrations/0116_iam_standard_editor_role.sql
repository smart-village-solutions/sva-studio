-- +goose Up
-- +goose StatementBegin
-- Goose executes this one-time backfill transactionally. No schema or ongoing repair job.
LOCK TABLE iam.instances IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE iam.roles IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE standard_editor_profile (
  permission_key text PRIMARY KEY, access_scope text NOT NULL, module_id text
) ON COMMIT DROP;
INSERT INTO standard_editor_profile VALUES
  ('modules.read', 'all', NULL),
  ('content.read', 'organization', NULL),
  ('content.create', 'all', NULL),
  ('content.updateMetadata', 'organization', NULL),
  ('content.updatePayload', 'organization', NULL),
  ('content.changeStatus', 'organization', NULL),
  ('content.publish', 'organization', NULL),
  ('content.archive', 'organization', NULL),
  ('content.restore', 'organization', NULL),
  ('content.readHistory', 'organization', NULL),
  ('content.delete', 'organization', NULL),
  ('news.read', 'organization', 'news'),
  ('news.create', 'all', 'news'),
  ('news.update', 'organization', 'news'),
  ('news.delete', 'organization', 'news'),
  ('events.read', 'organization', 'events'),
  ('events.create', 'all', 'events'),
  ('events.update', 'organization', 'events'),
  ('events.delete', 'organization', 'events'),
  ('poi.read', 'organization', 'poi'),
  ('poi.create', 'all', 'poi'),
  ('poi.update', 'organization', 'poi'),
  ('poi.delete', 'organization', 'poi'),
  ('generic-items.read', 'organization', 'generic-items'),
  ('generic-items.create', 'all', 'generic-items'),
  ('generic-items.update', 'organization', 'generic-items'),
  ('generic-items.delete', 'organization', 'generic-items'),
  ('faq.read', 'organization', 'faq'),
  ('faq.create', 'all', 'faq'),
  ('faq.update', 'organization', 'faq'),
  ('faq.delete', 'organization', 'faq'),
  ('cockpit-cards.read', 'organization', 'cockpit-cards'),
  ('cockpit-cards.create', 'all', 'cockpit-cards'),
  ('cockpit-cards.update', 'organization', 'cockpit-cards'),
  ('cockpit-cards.delete', 'organization', 'cockpit-cards'),
  ('projects.read', 'organization', 'projects'),
  ('projects.create', 'all', 'projects'),
  ('projects.update', 'organization', 'projects'),
  ('projects.delete', 'organization', 'projects'),
  ('surveys.read', 'organization', 'surveys'),
  ('surveys.create', 'all', 'surveys'),
  ('surveys.update', 'organization', 'surveys'),
  ('surveys.delete', 'organization', 'surveys'),
  ('construction-sites.read', 'organization', 'construction-sites'),
  ('construction-sites.create', 'all', 'construction-sites'),
  ('construction-sites.update', 'organization', 'construction-sites'),
  ('jobs.read', 'organization', 'jobs'),
  ('jobs.create', 'all', 'jobs'),
  ('jobs.update', 'organization', 'jobs'),
  ('jobs.delete', 'organization', 'jobs'),
  ('vouchers.read', 'organization', 'vouchers'),
  ('vouchers.create', 'all', 'vouchers'),
  ('vouchers.update', 'organization', 'vouchers'),
  ('vouchers.delete', 'organization', 'vouchers'),
  ('news.pushNotification', 'organization', 'news'),
  ('vouchers.publish', 'organization', 'vouchers'),
  ('media.read', 'all', 'media'),
  ('media.create', 'all', 'media'),
  ('media.update', 'all', 'media'),
  ('media.reference.manage', 'all', 'media'),
  ('media.delete', 'all', 'media'),
  ('categories.read', 'all', 'categories'),
  ('categories.create', 'all', 'categories'),
  ('categories.update', 'all', 'categories'),
  ('categories.delete', 'all', 'categories');

CREATE TEMP TABLE standard_editor_expected ON COMMIT DROP AS
SELECT instance.id AS instance_id, profile.*
FROM iam.instances instance CROSS JOIN standard_editor_profile profile
WHERE profile.module_id IS NULL OR profile.module_id IN ('media', 'categories')
  OR EXISTS (SELECT 1 FROM iam.instance_modules module
    WHERE module.instance_id = instance.id AND module.module_id = profile.module_id AND module.effective_active);

-- Stop before changing anything when an existing identity/name needs explicit reconciliation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM standard_editor_expected expected JOIN iam.permissions permission
    ON permission.instance_id = expected.instance_id AND permission.permission_key = expected.permission_key
    WHERE permission.action <> expected.permission_key
      OR permission.resource_type <> split_part(expected.permission_key, '.', 1)
      OR permission.resource_id IS NOT NULL OR permission.scope <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'standard_editor_permission_conflict: reconcile canonical permission definitions before retry';
  END IF;
  IF EXISTS (SELECT 1 FROM iam.roles WHERE role_key <> 'standard_editor'
    AND (display_name = 'Standard Redakteur' OR role_name = 'Standard Redakteur'))
  OR EXISTS (SELECT 1 FROM iam.roles role WHERE role_key = 'standard_editor' AND (
    is_system_role OR managed_by <> 'studio' OR display_name <> 'Standard Redakteur'
    OR role_name <> 'standard_editor' OR external_role_name <> 'standard_editor' OR role_level <> 0
    OR description IS DISTINCT FROM 'studio:standard-editor:v1'
    OR EXISTS (SELECT expected.permission_key, expected.access_scope
      FROM standard_editor_expected expected WHERE expected.instance_id = role.instance_id
      EXCEPT SELECT permission.permission_key, grant_row.access_scope
      FROM iam.role_permissions grant_row JOIN iam.permissions permission
        ON permission.instance_id = grant_row.instance_id AND permission.id = grant_row.permission_id
      WHERE grant_row.instance_id = role.instance_id AND grant_row.role_id = role.id)
    OR EXISTS (SELECT permission.permission_key, grant_row.access_scope
      FROM iam.role_permissions grant_row JOIN iam.permissions permission
        ON permission.instance_id = grant_row.instance_id AND permission.id = grant_row.permission_id
      WHERE grant_row.instance_id = role.instance_id AND grant_row.role_id = role.id
      EXCEPT SELECT expected.permission_key, expected.access_scope
      FROM standard_editor_expected expected WHERE expected.instance_id = role.instance_id)
  )) THEN
    RAISE EXCEPTION 'standard_editor_profile_conflict: existing roles are unchanged; reconcile identity/profile before retry';
  END IF;
END $$;

CREATE TEMP TABLE standard_editor_created ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO iam.roles (instance_id, role_key, role_name, display_name, external_role_name,
    description, is_system_role, role_level, managed_by, sync_state, last_synced_at)
  SELECT id, 'standard_editor', 'standard_editor', 'Standard Redakteur', 'standard_editor',
    'studio:standard-editor:v1', FALSE, 0, 'studio', 'synced', NOW()
  FROM iam.instances instance
  WHERE NOT EXISTS (SELECT 1 FROM iam.roles role
    WHERE role.instance_id = instance.id AND role.role_key = 'standard_editor')
  RETURNING instance_id, id
) SELECT * FROM inserted;

INSERT INTO iam.permissions (instance_id, permission_key, action, resource_type, description)
SELECT expected.instance_id, expected.permission_key, expected.permission_key,
  split_part(expected.permission_key, '.', 1), 'Standard editorial action ' || expected.permission_key
FROM standard_editor_expected expected
JOIN standard_editor_created created USING (instance_id)
ON CONFLICT (instance_id, permission_key) DO NOTHING;

INSERT INTO iam.role_permissions (instance_id, role_id, permission_id, access_scope,
  grant_origin_kind, grant_origin_module_id)
SELECT created.instance_id, created.id, permission.id, expected.access_scope,
  CASE WHEN expected.module_id IS NULL THEN 'bootstrap' ELSE 'module_sync' END, expected.module_id
FROM standard_editor_created created
JOIN standard_editor_expected expected USING (instance_id)
JOIN iam.permissions permission ON permission.instance_id = expected.instance_id
  AND permission.permission_key = expected.permission_key;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM standard_editor_created created
    JOIN standard_editor_expected expected USING (instance_id)
    WHERE NOT EXISTS (SELECT 1 FROM iam.role_permissions grant_row JOIN iam.permissions permission
      ON permission.instance_id = grant_row.instance_id AND permission.id = grant_row.permission_id
      WHERE grant_row.instance_id = created.instance_id AND grant_row.role_id = created.id
        AND permission.permission_key = expected.permission_key AND grant_row.access_scope = expected.access_scope))
  OR EXISTS (SELECT 1 FROM iam.account_roles member JOIN standard_editor_created created
    ON created.instance_id = member.instance_id AND created.id = member.role_id)
  THEN RAISE EXCEPTION 'standard_editor_backfill_verification_failed'; END IF;
END $$;

WITH revisions AS (
  INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision, updated_at)
  SELECT instance_id, 2, now() FROM standard_editor_created
  ON CONFLICT (instance_id) DO UPDATE SET revision = iam.permission_cache_instance_revisions.revision + 1, updated_at = now()
  RETURNING instance_id, revision
)
SELECT pg_notify('iam_permission_snapshot_invalidation', json_build_object(
  'eventId', gen_random_uuid()::text, 'event', 'PermissionRevisionChanged', 'instanceId', instance_id,
  'revisionScope', 'instance', 'newRevision', revision, 'trigger', 'pg_notify',
  'reason', 'standard_editor_backfilled')::text) FROM revisions;
-- +goose StatementEnd

-- +goose Down
-- Deliberately preserve roles, custom changes and memberships; rollback must not delete user data.
SELECT 1;
