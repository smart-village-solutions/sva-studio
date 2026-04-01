CREATE TABLE IF NOT EXISTS iam.account_permissions (
  instance_id TEXT NOT NULL,
  account_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  assigned_by_account_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id, permission_id),
  CONSTRAINT account_permissions_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE,
  CONSTRAINT account_permissions_permission_fk FOREIGN KEY (instance_id, permission_id)
    REFERENCES iam.permissions(instance_id, id) ON DELETE CASCADE,
  CONSTRAINT account_permissions_assigned_by_fk FOREIGN KEY (assigned_by_account_id)
    REFERENCES iam.accounts(id) ON DELETE SET NULL,
  CONSTRAINT account_permissions_effect_chk CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX IF NOT EXISTS idx_account_permissions_instance_account
  ON iam.account_permissions(instance_id, account_id);

CREATE INDEX IF NOT EXISTS idx_account_permissions_instance_permission
  ON iam.account_permissions(instance_id, permission_id);

ALTER TABLE iam.account_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_permissions_isolation_policy ON iam.account_permissions;
CREATE POLICY account_permissions_isolation_policy
  ON iam.account_permissions
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
