-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.instance_deletion_rules (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  deactivate_after_days INTEGER NOT NULL,
  pseudonymize_after_days INTEGER NOT NULL,
  delete_after_days INTEGER NOT NULL,
  default_content_strategy TEXT NOT NULL DEFAULT 'retain',
  allow_content_preference_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT instance_deletion_rules_deactivate_after_days_chk CHECK (deactivate_after_days > 0),
  CONSTRAINT instance_deletion_rules_pseudonymize_after_days_chk CHECK (
    pseudonymize_after_days > deactivate_after_days
  ),
  CONSTRAINT instance_deletion_rules_delete_after_days_chk CHECK (
    delete_after_days > pseudonymize_after_days
  ),
  CONSTRAINT instance_deletion_rules_default_content_strategy_chk CHECK (
    default_content_strategy IN ('retain', 'with_owner_lifecycle')
  )
);

CREATE TABLE IF NOT EXISTS iam.account_deletion_content_preferences (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  content_strategy TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, account_id),
  CONSTRAINT account_deletion_content_preferences_content_strategy_chk CHECK (
    content_strategy IN ('retain', 'with_owner_lifecycle')
  ),
  CONSTRAINT account_deletion_content_preferences_membership_fk FOREIGN KEY (instance_id, account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE
);

ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pseudonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_marked_at TIMESTAMPTZ;

ALTER TABLE iam.contents
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_lifecycle_changed_at TIMESTAMPTZ;

ALTER TABLE iam.accounts
  DROP CONSTRAINT IF EXISTS accounts_deletion_lifecycle_state_chk;
ALTER TABLE iam.accounts
  ADD CONSTRAINT accounts_deletion_lifecycle_state_chk CHECK (
    deletion_lifecycle_state IN ('active', 'deactivated', 'pseudonymized', 'deleted')
  );

ALTER TABLE iam.contents
  DROP CONSTRAINT IF EXISTS contents_deletion_lifecycle_state_chk;
ALTER TABLE iam.contents
  ADD CONSTRAINT contents_deletion_lifecycle_state_chk CHECK (
    deletion_lifecycle_state IN ('active', 'deactivated', 'pseudonymized', 'deleted')
  );

ALTER TABLE iam.instance_deletion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_deletion_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instance_deletion_rules_isolation_policy ON iam.instance_deletion_rules;
CREATE POLICY instance_deletion_rules_isolation_policy
  ON iam.instance_deletion_rules
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());

ALTER TABLE iam.account_deletion_content_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.account_deletion_content_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_deletion_content_preferences_isolation_policy ON iam.account_deletion_content_preferences;
CREATE POLICY account_deletion_content_preferences_isolation_policy
  ON iam.account_deletion_content_preferences
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS account_deletion_content_preferences_isolation_policy ON iam.account_deletion_content_preferences;
DROP POLICY IF EXISTS instance_deletion_rules_isolation_policy ON iam.instance_deletion_rules;

DROP TABLE IF EXISTS iam.account_deletion_content_preferences;
DROP TABLE IF EXISTS iam.instance_deletion_rules;

ALTER TABLE iam.contents
  DROP CONSTRAINT IF EXISTS contents_deletion_lifecycle_state_chk,
  DROP COLUMN IF EXISTS deletion_lifecycle_changed_at,
  DROP COLUMN IF EXISTS deletion_lifecycle_state;

ALTER TABLE iam.accounts
  DROP CONSTRAINT IF EXISTS accounts_deletion_lifecycle_state_chk,
  DROP COLUMN IF EXISTS deletion_marked_at,
  DROP COLUMN IF EXISTS pseudonymized_at,
  DROP COLUMN IF EXISTS deactivated_at,
  DROP COLUMN IF EXISTS deletion_lifecycle_state,
  DROP COLUMN IF EXISTS last_login_at;
-- +goose StatementEnd
