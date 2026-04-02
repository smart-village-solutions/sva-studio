-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM iam.accounts GROUP BY id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add accounts primary key: duplicate iam.accounts.id values exist';
  END IF;

  IF EXISTS (SELECT 1 FROM iam.roles GROUP BY id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add roles primary key: duplicate iam.roles.id values exist';
  END IF;

  IF EXISTS (SELECT 1 FROM iam.groups GROUP BY id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add groups primary key: duplicate iam.groups.id values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM iam.instance_memberships
    GROUP BY instance_id, account_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add instance_memberships primary key: duplicate membership rows exist';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_pkey'
      AND conrelid = 'iam.accounts'::regclass
  ) THEN
    ALTER TABLE iam.accounts
      ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_pkey'
      AND conrelid = 'iam.roles'::regclass
  ) THEN
    ALTER TABLE iam.roles
      ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_pkey'
      AND conrelid = 'iam.groups'::regclass
  ) THEN
    ALTER TABLE iam.groups
      ADD CONSTRAINT groups_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instance_memberships_pkey'
      AND conrelid = 'iam.instance_memberships'::regclass
  ) THEN
    ALTER TABLE iam.instance_memberships
      ADD CONSTRAINT instance_memberships_pkey PRIMARY KEY (instance_id, account_id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_kc_subject_instance
  ON iam.accounts(keycloak_subject, instance_id)
  WHERE instance_id IS NOT NULL;

ALTER TABLE iam.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_isolation_policy ON iam.accounts;
CREATE POLICY accounts_isolation_policy
  ON iam.accounts
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.instance_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva') THEN
    GRANT USAGE ON SCHEMA iam TO sva;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO sva;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO sva;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva_app') THEN
    GRANT iam_app TO sva_app;
    GRANT USAGE ON SCHEMA iam TO sva_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO sva_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO sva_app;
  END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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
  WITH CHECK (iam.current_instance_id() IS NOT NULL);

DROP POLICY IF EXISTS instance_memberships_isolation_policy ON iam.instance_memberships;
CREATE POLICY instance_memberships_isolation_policy
  ON iam.instance_memberships
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd
