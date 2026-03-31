CREATE TABLE IF NOT EXISTS iam.account_permissions (
  instance_id   TEXT        NOT NULL,
  account_id    UUID        NOT NULL,
  permission_id UUID        NOT NULL,
  effect        TEXT        NOT NULL DEFAULT 'allow',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, permission_id),
  CONSTRAINT account_permissions_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_permissions_effect_chk'
      AND conrelid = 'iam.account_permissions'::regclass
  ) THEN
    ALTER TABLE iam.account_permissions
      ADD CONSTRAINT account_permissions_effect_chk
      CHECK (effect IN ('allow', 'deny'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_permissions_account
  ON iam.account_permissions(instance_id, account_id);

CREATE INDEX IF NOT EXISTS idx_account_permissions_permission
  ON iam.account_permissions(instance_id, permission_id);
