-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS iam;

CREATE TABLE IF NOT EXISTS iam.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject TEXT NOT NULL UNIQUE,
  email_ciphertext TEXT,
  display_name_ciphertext TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  organization_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_instance_key_uniq UNIQUE (instance_id, organization_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_instance_id_id
  ON iam.organizations(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_instance_name_uniq UNIQUE (instance_id, role_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_instance_id_id
  ON iam.roles(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissions_instance_key_uniq UNIQUE (instance_id, permission_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_instance_id_id
  ON iam.permissions(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.instance_memberships (
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES iam.accounts(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id)
);

CREATE TABLE IF NOT EXISTS iam.account_organizations (
  instance_id UUID NOT NULL,
  account_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, organization_id),
  CONSTRAINT account_org_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_org_organization_fk FOREIGN KEY (instance_id, organization_id)
    REFERENCES iam.organizations(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.account_roles (
  instance_id UUID NOT NULL,
  account_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, role_id),
  CONSTRAINT account_roles_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.role_permissions (
  instance_id UUID NOT NULL,
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, role_id, permission_id),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_instance_id
  ON iam.organizations(instance_id);

CREATE INDEX IF NOT EXISTS idx_roles_instance_id
  ON iam.roles(instance_id);

CREATE INDEX IF NOT EXISTS idx_permissions_instance_id
  ON iam.permissions(instance_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_instance_id_created_at
  ON iam.activity_logs(instance_id, created_at DESC);

DO $$
DECLARE
  instance_id_is_uuid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'instances'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  )
  INTO instance_id_is_uuid;

  EXECUTE 'DROP FUNCTION IF EXISTS iam.current_instance_id() CASCADE';

  IF instance_id_is_uuid THEN
    EXECUTE $sql$
      CREATE FUNCTION iam.current_instance_id()
      RETURNS UUID
      LANGUAGE SQL
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('app.instance_id', true), '')::uuid
      $fn$
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE FUNCTION iam.current_instance_id()
      RETURNS TEXT
      LANGUAGE SQL
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('app.instance_id', true), '')
      $fn$
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_app') THEN
    CREATE ROLE iam_app NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA iam TO iam_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO iam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT USAGE, SELECT ON SEQUENCES TO iam_app;

ALTER TABLE iam.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instances_isolation_policy ON iam.instances;
CREATE POLICY instances_isolation_policy
  ON iam.instances
  USING (id = iam.current_instance_id())
  WITH CHECK (id = iam.current_instance_id());

ALTER TABLE iam.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (
    EXISTS (
      SELECT 1
      FROM iam.instance_memberships membership
      WHERE membership.account_id = iam.accounts.id
        AND membership.instance_id = iam.current_instance_id()
    )
  )
  WITH CHECK (
    iam.current_instance_id() IS NOT NULL
  );

ALTER TABLE iam.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_isolation_policy ON iam.organizations;
CREATE POLICY organizations_isolation_policy
  ON iam.organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_isolation_policy ON iam.roles;
CREATE POLICY roles_isolation_policy
  ON iam.roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_isolation_policy ON iam.permissions;
CREATE POLICY permissions_isolation_policy
  ON iam.permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.instance_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_organizations_isolation_policy ON iam.account_organizations;
CREATE POLICY account_organizations_isolation_policy
  ON iam.account_organizations
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_roles_isolation_policy ON iam.account_roles;
CREATE POLICY account_roles_isolation_policy
  ON iam.account_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_isolation_policy ON iam.role_permissions;
CREATE POLICY role_permissions_isolation_policy
  ON iam.role_permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.activity_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_logs_isolation_policy ON iam.activity_logs;
CREATE POLICY activity_logs_isolation_policy
  ON iam.activity_logs
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Destruktiv: entfernt das komplette IAM-Schema inkl. Daten.
-- Dieser Down-Pfad ist nur für lokale Entwicklung/Tests vorgesehen.
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
DROP TABLE IF EXISTS iam.activity_logs;
DROP TABLE IF EXISTS iam.role_permissions;
DROP TABLE IF EXISTS iam.account_roles;
DROP TABLE IF EXISTS iam.account_organizations;
DROP TABLE IF EXISTS iam.instance_memberships;
DROP TABLE IF EXISTS iam.accounts;
DROP TABLE IF EXISTS iam.permissions;
DROP TABLE IF EXISTS iam.roles;
DROP TABLE IF EXISTS iam.organizations;
DROP TABLE IF EXISTS iam.instances;
DROP FUNCTION IF EXISTS iam.current_instance_id();
ALTER DEFAULT PRIVILEGES IN SCHEMA iam REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM iam_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA iam REVOKE USAGE, SELECT ON SEQUENCES FROM iam_app;
DROP SCHEMA IF EXISTS iam;
-- iam_app ist eine clusterweite Rolle und bleibt bewusst bestehen.
-- +goose StatementEnd
