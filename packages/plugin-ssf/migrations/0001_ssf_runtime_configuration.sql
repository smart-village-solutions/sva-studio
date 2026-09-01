-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ssf_plugin_migrator') THEN
    CREATE ROLE ssf_plugin_migrator NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ssf_plugin_root') THEN
    CREATE ROLE ssf_plugin_root NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ssf_plugin_tenant_runtime') THEN
    CREATE ROLE ssf_plugin_tenant_runtime NOLOGIN NOINHERIT;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS ssf;
REVOKE ALL ON SCHEMA ssf FROM PUBLIC;

CREATE OR REPLACE FUNCTION ssf.current_instance_id()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(current_setting('app.instance_id', true), '')
$function$;

CREATE TABLE ssf.server_settings (
  singleton boolean PRIMARY KEY DEFAULT true,
  default_locale varchar(35),
  logo_media_reference varchar(2048),
  icon_media_reference varchar(2048),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_settings_singleton_check CHECK (singleton),
  CONSTRAINT server_settings_default_locale_check CHECK (
    default_locale IS NULL OR (
      char_length(default_locale) <= 35
      AND default_locale ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'
    )
  )
);

CREATE TABLE ssf.server_locales (
  locale varchar(35) PRIMARY KEY,
  available boolean,
  authenticated_home_explanation_html text,
  guest_explanation_html text,
  conversation_content_storage_question_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_locales_locale_check CHECK (
    char_length(locale) <= 35
    AND locale ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'
  ),
  CONSTRAINT server_locales_authenticated_html_size_check CHECK (
    authenticated_home_explanation_html IS NULL
    OR octet_length(authenticated_home_explanation_html) <= 65536
  ),
  CONSTRAINT server_locales_guest_html_size_check CHECK (
    guest_explanation_html IS NULL OR octet_length(guest_explanation_html) <= 65536
  ),
  CONSTRAINT server_locales_storage_html_size_check CHECK (
    conversation_content_storage_question_html IS NULL
    OR octet_length(conversation_content_storage_question_html) <= 65536
  )
);

CREATE TABLE ssf.tenant_settings (
  instance_id varchar(128) PRIMARY KEY,
  default_locale varchar(35),
  custom_branding_allowed boolean,
  conversation_content_storage_allowed boolean,
  conversation_content_storage_mode varchar(16),
  logo_media_reference varchar(2048),
  icon_media_reference varchar(2048),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_settings_instance_id_check CHECK (char_length(instance_id) > 0),
  CONSTRAINT tenant_settings_default_locale_check CHECK (
    default_locale IS NULL OR (
      char_length(default_locale) <= 35
      AND default_locale ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'
    )
  ),
  CONSTRAINT tenant_settings_storage_mode_check CHECK (
    conversation_content_storage_mode IS NULL
    OR conversation_content_storage_mode IN ('ask', 'disabled')
  )
);

CREATE TABLE ssf.tenant_locales (
  instance_id varchar(128) NOT NULL,
  locale varchar(35) NOT NULL,
  enabled boolean,
  authenticated_home_explanation_html text,
  guest_explanation_html text,
  conversation_content_storage_question_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_locales_pkey PRIMARY KEY (instance_id, locale),
  CONSTRAINT tenant_locales_instance_id_check CHECK (char_length(instance_id) > 0),
  CONSTRAINT tenant_locales_locale_check CHECK (
    char_length(locale) <= 35
    AND locale ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'
  ),
  CONSTRAINT tenant_locales_authenticated_html_size_check CHECK (
    authenticated_home_explanation_html IS NULL
    OR octet_length(authenticated_home_explanation_html) <= 65536
  ),
  CONSTRAINT tenant_locales_guest_html_size_check CHECK (
    guest_explanation_html IS NULL OR octet_length(guest_explanation_html) <= 65536
  ),
  CONSTRAINT tenant_locales_storage_html_size_check CHECK (
    conversation_content_storage_question_html IS NULL
    OR octet_length(conversation_content_storage_question_html) <= 65536
  )
);

ALTER TABLE ssf.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf.tenant_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_settings_tenant_isolation_policy
  ON ssf.tenant_settings
  FOR ALL
  TO ssf_plugin_tenant_runtime
  USING (instance_id = ssf.current_instance_id())
  WITH CHECK (instance_id = ssf.current_instance_id());
CREATE POLICY tenant_settings_root_policy
  ON ssf.tenant_settings
  FOR ALL
  TO ssf_plugin_root
  USING (true)
  WITH CHECK (true);

ALTER TABLE ssf.tenant_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf.tenant_locales FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_locales_tenant_isolation_policy
  ON ssf.tenant_locales
  FOR ALL
  TO ssf_plugin_tenant_runtime
  USING (instance_id = ssf.current_instance_id())
  WITH CHECK (instance_id = ssf.current_instance_id());
CREATE POLICY tenant_locales_root_policy
  ON ssf.tenant_locales
  FOR ALL
  TO ssf_plugin_root
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA ssf TO ssf_plugin_root, ssf_plugin_tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ssf TO ssf_plugin_root;
GRANT SELECT ON ssf.server_settings, ssf.server_locales TO ssf_plugin_tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ssf.tenant_settings, ssf.tenant_locales
  TO ssf_plugin_tenant_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA ssf
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ssf_plugin_root;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP SCHEMA IF EXISTS ssf CASCADE;
-- +goose StatementEnd
