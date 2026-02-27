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
