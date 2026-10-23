-- +goose Up
-- +goose StatementBegin
INSERT INTO iam.external_interface_types(type_key,owner_kind,owner_id,display_name,category,public_schema_json,secret_schema_json,status_check_kind)
VALUES ('deepl','host','host','DeepL','api','{}','{"apiKey":{"type":"string"}}','deepl')
ON CONFLICT (type_key) DO NOTHING;
CREATE UNIQUE INDEX idx_instance_deepl_interface ON iam.instance_external_interfaces(instance_id) WHERE type_key='deepl';
-- Preserve old selections without claiming a verified provider connection.
INSERT INTO iam.instance_external_interfaces AS existing(id,instance_id,type_key,owner_kind,owner_id,display_name,alias,enabled,is_default,category,base_url,auth_mode,public_config_json,status_check_kind,visible_status)
SELECT 'deepl:'||i.id,i.id,'deepl','host','host','DeepL','deepl',true,true,'api','https://api.deepl.com','api_key',
 jsonb_build_object('revision',gen_random_uuid()::text,'credentialRevision',gen_random_uuid()::text,'plan','pro','englishVariant','en-GB','availableLanguages','[]'::jsonb,
 'selectedLocales',COALESCE((SELECT jsonb_agg(l.locale ORDER BY l.locale) FROM iam.instance_languages l JOIN iam.available_languages a USING(locale) WHERE l.instance_id=i.id AND l.enabled AND a.available),'[]'::jsonb),
 'legacyLanguageAssignments',COALESCE((SELECT jsonb_agg(to_jsonb(l)-'instance_id') FROM iam.instance_languages l WHERE l.instance_id=i.id),'[]'::jsonb),
 'legacyLanguageAvailability',(SELECT jsonb_agg(to_jsonb(a)) FROM iam.available_languages a)),
 'deepl','not_configured'
FROM iam.instances i
ON CONFLICT (instance_id) WHERE type_key='deepl' DO UPDATE SET
 public_config_json=existing.public_config_json || jsonb_build_object(
  'revision',EXCLUDED.public_config_json->'revision',
  'selectedLocales',EXCLUDED.public_config_json->'selectedLocales',
  'legacyLanguageAssignments',EXCLUDED.public_config_json->'legacyLanguageAssignments',
  'legacyLanguageAvailability',EXCLUDED.public_config_json->'legacyLanguageAvailability'),updated_at=now();
DROP TABLE iam.instance_languages;
DROP TABLE iam.available_languages;
-- +goose StatementEnd

-- +goose Down
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


-- Rollback restores the former configuration while retaining DeepL credentials and catalogs.
INSERT INTO iam.available_languages(locale,available,revision)
SELECT DISTINCT ON (locale) locale,available,revision FROM iam.instance_external_interfaces e,
 jsonb_to_recordset(COALESCE(e.public_config_json->'legacyLanguageAvailability','[]')) AS x(locale text,available boolean,revision bigint)
 WHERE e.type_key='deepl' ORDER BY locale
ON CONFLICT(locale) DO UPDATE SET available=EXCLUDED.available,revision=EXCLUDED.revision;
-- Current provider selections can include languages added after migration 0107.
INSERT INTO iam.available_languages(locale)
SELECT x.locale FROM iam.instance_external_interfaces e,
 jsonb_array_elements_text(COALESCE(e.public_config_json->'selectedLocales','[]')) AS x(locale)
 WHERE e.type_key='deepl' ON CONFLICT DO NOTHING;
INSERT INTO iam.instance_languages(instance_id,locale,enabled,revision)
SELECT e.instance_id,x.locale,
 (e.public_config_json->'selectedLocales' ? x.locale) OR
 (x.enabled AND EXISTS(SELECT 1 FROM iam.available_languages a WHERE a.locale=x.locale AND NOT a.available)),x.revision FROM iam.instance_external_interfaces e,
 jsonb_to_recordset(COALESCE(e.public_config_json->'legacyLanguageAssignments','[]')) AS x(locale text,enabled boolean,revision bigint)
 WHERE e.type_key='deepl' ON CONFLICT DO NOTHING;
INSERT INTO iam.instance_languages(instance_id,locale,enabled)
SELECT e.instance_id,x.locale,true FROM iam.instance_external_interfaces e,
 jsonb_array_elements_text(COALESCE(e.public_config_json->'selectedLocales','[]')) AS x(locale)
 WHERE e.type_key='deepl' ON CONFLICT(instance_id,locale) DO UPDATE SET enabled=true;
DROP INDEX iam.idx_instance_deepl_interface;
-- Keep the type and its records so rollback never discards a stored API key.
-- +goose StatementEnd
