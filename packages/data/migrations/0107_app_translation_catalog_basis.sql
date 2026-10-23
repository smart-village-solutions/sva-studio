-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.app_translation_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  digest TEXT NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, manifest_version),
  UNIQUE (id, contract_id)
);
CREATE TABLE iam.app_translation_catalog_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'municipal')),
  instance_id TEXT,
  organization_id UUID,
  contract_id TEXT NOT NULL,
  manifest_id UUID NOT NULL,
  catalog_set_revision BIGINT NOT NULL CHECK (catalog_set_revision > 0),
  draft_revision BIGINT NOT NULL CHECK (draft_revision > 0),
  base_release_id UUID REFERENCES iam.app_translation_catalog_releases(id),
  supported_locales JSONB NOT NULL CHECK (jsonb_typeof(supported_locales) = 'array' AND supported_locales ? 'de'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL DEFAULT 'sealed' CHECK (state = 'sealed'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (manifest_id, contract_id) REFERENCES iam.app_translation_manifests(id, contract_id),
  FOREIGN KEY (instance_id, organization_id) REFERENCES iam.organizations(instance_id, id),
  CHECK ((scope = 'global' AND instance_id IS NULL AND organization_id IS NULL AND base_release_id IS NULL) OR
         (scope = 'municipal' AND instance_id IS NOT NULL AND organization_id IS NOT NULL AND base_release_id IS NOT NULL))
);
CREATE UNIQUE INDEX app_translation_releases_global_key ON iam.app_translation_catalog_releases(contract_id, catalog_set_revision) WHERE scope = 'global';
CREATE UNIQUE INDEX app_translation_releases_municipal_key ON iam.app_translation_catalog_releases(instance_id, organization_id, contract_id, catalog_set_revision) WHERE scope = 'municipal';
CREATE TABLE iam.app_translation_catalog_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'municipal')),
  instance_id TEXT,
  organization_id UUID,
  contract_id TEXT NOT NULL,
  manifest_id UUID NOT NULL,
  draft_revision BIGINT NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  supported_locales JSONB NOT NULL CHECK (jsonb_typeof(supported_locales) = 'array' AND supported_locales ? 'de'),
  values_by_locale JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(values_by_locale) = 'object'),
  base_release_id UUID REFERENCES iam.app_translation_catalog_releases(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (manifest_id, contract_id) REFERENCES iam.app_translation_manifests(id, contract_id),
  FOREIGN KEY (instance_id, organization_id) REFERENCES iam.organizations(instance_id, id),
  CHECK ((scope = 'global' AND instance_id IS NULL AND organization_id IS NULL AND base_release_id IS NULL) OR
         (scope = 'municipal' AND instance_id IS NOT NULL AND organization_id IS NOT NULL AND base_release_id IS NOT NULL))
);
CREATE UNIQUE INDEX app_translation_drafts_global_key ON iam.app_translation_catalog_drafts(contract_id) WHERE scope = 'global';
CREATE UNIQUE INDEX app_translation_drafts_municipal_key ON iam.app_translation_catalog_drafts(instance_id, organization_id, contract_id) WHERE scope = 'municipal';
CREATE FUNCTION iam.reject_app_translation_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'app_translation_revision_immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER app_translation_manifests_immutable BEFORE UPDATE OR DELETE ON iam.app_translation_manifests FOR EACH ROW EXECUTE FUNCTION iam.reject_app_translation_revision_change();
CREATE TRIGGER app_translation_releases_immutable BEFORE UPDATE OR DELETE ON iam.app_translation_catalog_releases FOR EACH ROW EXECUTE FUNCTION iam.reject_app_translation_revision_change();
ALTER TABLE iam.app_translation_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.app_translation_manifests FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.app_translation_catalog_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.app_translation_catalog_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE iam.app_translation_catalog_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.app_translation_catalog_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY app_translation_manifest_read ON iam.app_translation_manifests FOR SELECT TO iam_app
USING ((nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL) OR
       (iam.current_instance_id() IS NOT NULL AND nullif(current_setting('app.organization_id', true), '') IS NOT NULL));
CREATE POLICY app_translation_manifest_import ON iam.app_translation_manifests FOR INSERT TO iam_app
WITH CHECK (nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL);
CREATE POLICY app_translation_draft_scope ON iam.app_translation_catalog_drafts TO iam_app
USING ((scope = 'global' AND nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL) OR
       (scope = 'municipal' AND instance_id = iam.current_instance_id() AND organization_id::text = nullif(current_setting('app.organization_id', true), '')))
WITH CHECK ((scope = 'global' AND nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL) OR
       (scope = 'municipal' AND instance_id = iam.current_instance_id() AND organization_id::text = nullif(current_setting('app.organization_id', true), '')));
CREATE POLICY app_translation_release_read ON iam.app_translation_catalog_releases FOR SELECT TO iam_app
USING ((scope = 'global' AND ((nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL) OR
       (iam.current_instance_id() IS NOT NULL AND nullif(current_setting('app.organization_id', true), '') IS NOT NULL))) OR
       (scope = 'municipal' AND instance_id = iam.current_instance_id() AND organization_id::text = nullif(current_setting('app.organization_id', true), '')));
CREATE POLICY app_translation_release_insert ON iam.app_translation_catalog_releases FOR INSERT TO iam_app
WITH CHECK ((scope = 'global' AND nullif(current_setting('app.catalog_platform', true), '') = 'true' AND iam.current_instance_id() IS NULL) OR
       (scope = 'municipal' AND instance_id = iam.current_instance_id() AND organization_id::text = nullif(current_setting('app.organization_id', true), '')));
REVOKE UPDATE, DELETE, TRUNCATE ON iam.app_translation_manifests, iam.app_translation_catalog_releases FROM iam_app;
REVOKE DELETE, TRUNCATE ON iam.app_translation_catalog_drafts FROM iam_app;
GRANT SELECT, INSERT ON iam.app_translation_manifests, iam.app_translation_catalog_releases TO iam_app;
GRANT SELECT, INSERT, UPDATE ON iam.app_translation_catalog_drafts TO iam_app;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE iam.app_translation_catalog_drafts;
DROP TABLE iam.app_translation_catalog_releases;
DROP TABLE iam.app_translation_manifests;
DROP FUNCTION iam.reject_app_translation_revision_change();
-- +goose StatementEnd
