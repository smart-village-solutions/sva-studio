CREATE TABLE IF NOT EXISTS iam.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'role_bundle',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_instance_key_uniq UNIQUE (instance_id, group_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_instance_id_id
  ON iam.groups(instance_id, id);

CREATE TABLE IF NOT EXISTS iam.group_roles (
  instance_id TEXT NOT NULL,
  group_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, group_id, role_id),
  CONSTRAINT group_roles_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT group_roles_role_fk FOREIGN KEY (instance_id, role_id)
    REFERENCES iam.roles(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.account_groups (
  instance_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  group_id UUID NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, group_id),
  CONSTRAINT account_groups_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_groups_group_fk FOREIGN KEY (instance_id, group_id)
    REFERENCES iam.groups(instance_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iam.geo_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  geo_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  geo_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parent_geo_unit_id UUID,
  hierarchy_path UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  depth INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_units_instance_key_uniq UNIQUE (instance_id, geo_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_geo_units_instance_id_id
  ON iam.geo_units(instance_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_type_chk'
      AND conrelid = 'iam.groups'::regclass
  ) THEN
    ALTER TABLE iam.groups
      ADD CONSTRAINT groups_type_chk
      CHECK (group_type IN ('role_bundle'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_origin_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'origin'
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_origin_chk
      CHECK (origin IN ('manual', 'seed', 'sync'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_groups_validity_chk'
      AND conrelid = 'iam.account_groups'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'valid_to'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'iam'
      AND table_name = 'account_groups'
      AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE iam.account_groups
      ADD CONSTRAINT account_groups_validity_chk
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_parent_fk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_parent_fk
      FOREIGN KEY (instance_id, parent_geo_unit_id)
      REFERENCES iam.geo_units(instance_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_parent_not_self_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_parent_not_self_chk
      CHECK (parent_geo_unit_id IS NULL OR parent_geo_unit_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_depth_nonnegative_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_depth_nonnegative_chk
      CHECK (depth >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_units_type_chk'
      AND conrelid = 'iam.geo_units'::regclass
  ) THEN
    ALTER TABLE iam.geo_units
      ADD CONSTRAINT geo_units_type_chk
      CHECK (geo_type IN ('country', 'state', 'county', 'municipality', 'district', 'custom'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_groups_instance_active
  ON iam.groups(instance_id, is_active);

CREATE INDEX IF NOT EXISTS idx_account_groups_group_account
  ON iam.account_groups(instance_id, group_id, account_id);

CREATE INDEX IF NOT EXISTS idx_geo_units_parent
  ON iam.geo_units(instance_id, parent_geo_unit_id);

CREATE INDEX IF NOT EXISTS idx_geo_units_type_active
  ON iam.geo_units(instance_id, geo_type, is_active);

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

ALTER TABLE iam.geo_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.geo_units FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_units_isolation_policy ON iam.geo_units;
CREATE POLICY geo_units_isolation_policy
  ON iam.geo_units
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
