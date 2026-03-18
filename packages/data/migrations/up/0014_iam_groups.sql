-- Migration 0014: IAM Groups
-- Instanzgebundene Gruppen als eigenständige IAM-Entität (Paket 3).
-- Gruppen bündeln Rollen im ersten Schnitt (keine direkten Permissions).

CREATE TABLE IF NOT EXISTS iam.groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  UUID        NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  group_key    TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  description  TEXT,
  group_type   TEXT        NOT NULL DEFAULT 'custom',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_instance_key_uniq UNIQUE (instance_id, group_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_instance_id_id
  ON iam.groups(instance_id, id);

-- Gruppen bündeln Rollen: group → role (n:m)
CREATE TABLE IF NOT EXISTS iam.group_roles (
  instance_id UUID NOT NULL,
  group_id    UUID NOT NULL,
  role_id     UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, group_id, role_id),
  CONSTRAINT group_roles_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT group_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

-- Account-zu-Gruppen-Zuordnung mit optionalem Gültigkeitszeitraum
CREATE TABLE IF NOT EXISTS iam.account_groups (
  instance_id UUID        NOT NULL,
  account_id  UUID        NOT NULL,
  group_id    UUID        NOT NULL,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  PRIMARY KEY (instance_id, account_id, group_id),
  CONSTRAINT account_groups_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_groups_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE
);

-- Index: aktive Gruppenmitgliedschaften per Account schnell abrufbar
CREATE INDEX IF NOT EXISTS idx_account_groups_account
  ON iam.account_groups(instance_id, account_id)
  WHERE valid_until IS NULL OR valid_until > now();

CREATE INDEX IF NOT EXISTS idx_account_groups_group
  ON iam.account_groups(instance_id, group_id);

CREATE INDEX IF NOT EXISTS idx_group_roles_group
  ON iam.group_roles(instance_id, group_id);

-- RLS: Instanzisolation
ALTER TABLE iam.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS groups_isolation_policy ON iam.groups;
CREATE POLICY groups_isolation_policy
  ON iam.groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.group_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_roles_isolation_policy ON iam.group_roles;
CREATE POLICY group_roles_isolation_policy
  ON iam.group_roles
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_groups_isolation_policy ON iam.account_groups;
CREATE POLICY account_groups_isolation_policy
  ON iam.account_groups
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
