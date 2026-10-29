-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.available_languages (
  locale TEXT PRIMARY KEY CHECK (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  available BOOLEAN NOT NULL DEFAULT true,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  CHECK (locale <> 'de' OR available)
);
CREATE TABLE iam.instance_languages (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES iam.available_languages(locale),
  enabled BOOLEAN NOT NULL DEFAULT true,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (instance_id, locale),
  CHECK (locale <> 'de')
);
INSERT INTO iam.available_languages(locale) VALUES
  ('de'),
  ('en'),
  ('uk'),
  ('es'),
  ('it'),
  ('pt-PT'),
  ('el'),
  ('ko'),
  ('id'),
  ('zh-Hans'),
  ('ja'),
  ('th'),
  ('tr'),
  ('pl'),
  ('da'),
  ('sv'),
  ('fi'),
  ('ru'),
  ('lv'),
  ('ro');
ALTER TABLE iam.available_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.available_languages FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_languages FORCE ROW LEVEL SECURITY;
CREATE POLICY languages_read ON iam.available_languages FOR SELECT TO iam_app USING (true);
CREATE POLICY languages_root_update ON iam.available_languages FOR UPDATE TO iam_app
USING (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL)
WITH CHECK (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL);
CREATE POLICY instance_languages_read ON iam.instance_languages FOR SELECT TO iam_app
USING (instance_id = iam.current_instance_id() OR (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL));
CREATE POLICY instance_languages_root_write ON iam.instance_languages FOR ALL TO iam_app
USING (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL)
WITH CHECK (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL);
REVOKE ALL ON iam.available_languages, iam.instance_languages FROM iam_app;
GRANT SELECT, UPDATE ON iam.available_languages TO iam_app;
GRANT SELECT, INSERT, UPDATE ON iam.instance_languages TO iam_app;

WITH target_instances AS (SELECT DISTINCT instance_id FROM iam.roles WHERE role_key = 'system_admin')
INSERT INTO iam.permissions(id, instance_id, permission_key, action, resource_type, resource_id, scope, description)
SELECT gen_random_uuid(), i.instance_id, p.key, p.key, 'app-texts', NULL, '{}'::jsonb, p.description
FROM target_instances i CROSS JOIN (VALUES
 ('app-texts.catalog.read', 'Read German app texts'),
 ('app-texts.catalog.write', 'Edit German app texts'),
 ('app-texts.catalog.publish', 'Seal German app texts')
) p(key, description)
ON CONFLICT (instance_id, permission_key) DO NOTHING;
INSERT INTO iam.role_permissions(instance_id, role_id, permission_id, grant_origin_kind, access_scope)
SELECT r.instance_id, r.id, p.id, 'seed', 'all' FROM iam.roles r JOIN iam.permissions p ON p.instance_id=r.instance_id
WHERE r.role_key='system_admin' AND p.permission_key IN ('app-texts.catalog.read','app-texts.catalog.write','app-texts.catalog.publish')
ON CONFLICT (instance_id,role_id,permission_id) DO NOTHING;
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
    'reason', 'app_text_permissions_migrated'
  )::text
)
FROM bumped_revisions;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE iam.instance_languages;
DROP TABLE iam.available_languages;
-- Keep potentially delegated host permission grants on rollback.
-- +goose StatementEnd
