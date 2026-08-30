-- +goose Up
ALTER TABLE iam.instance_modules
  ADD COLUMN activation_policy text NOT NULL DEFAULT 'optional',
  ADD COLUMN activation_origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN effective_active boolean NOT NULL DEFAULT true,
  ADD COLUMN manual_override text,
  ADD COLUMN manifest_version integer NOT NULL DEFAULT 1,
  ADD COLUMN policy_revision text NOT NULL DEFAULT 'legacy',
  ADD COLUMN state_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN reconcile_id text,
  ADD COLUMN reconciled_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_by text;

UPDATE iam.instance_modules
SET
  activation_origin = 'migration',
  manual_override = 'enabled';

ALTER TABLE iam.instance_modules
  ADD CONSTRAINT instance_modules_activation_policy_check
    CHECK (activation_policy IN ('optional', 'automatic', 'required')),
  ADD CONSTRAINT instance_modules_activation_origin_check
    CHECK (activation_origin IN ('manual', 'policy_reconcile', 'migration')),
  ADD CONSTRAINT instance_modules_manual_override_check
    CHECK (manual_override IS NULL OR manual_override IN ('enabled', 'disabled')),
  ADD CONSTRAINT instance_modules_manifest_version_check
    CHECK (manifest_version > 0),
  ADD CONSTRAINT instance_modules_state_revision_check
    CHECK (state_revision > 0),
  ADD CONSTRAINT instance_modules_manual_override_state_check
    CHECK (
      manual_override IS NULL
      OR (manual_override = 'enabled' AND effective_active)
      OR (
        manual_override = 'enabled'
        AND activation_policy = 'optional'
        AND activation_origin = 'policy_reconcile'
      )
      OR (manual_override = 'disabled' AND NOT effective_active)
    ),
  ADD CONSTRAINT instance_modules_required_policy_check
    CHECK (
      activation_policy <> 'required'
      OR (effective_active AND manual_override IS NULL)
    );

CREATE INDEX instance_modules_active_instance_idx
  ON iam.instance_modules (instance_id, module_id)
  WHERE effective_active;

-- +goose Down
DROP INDEX IF EXISTS iam.instance_modules_active_instance_idx;

ALTER TABLE iam.instance_modules
  DROP CONSTRAINT IF EXISTS instance_modules_required_policy_check,
  DROP CONSTRAINT IF EXISTS instance_modules_manual_override_state_check,
  DROP CONSTRAINT IF EXISTS instance_modules_state_revision_check,
  DROP CONSTRAINT IF EXISTS instance_modules_manifest_version_check,
  DROP CONSTRAINT IF EXISTS instance_modules_manual_override_check,
  DROP CONSTRAINT IF EXISTS instance_modules_activation_origin_check,
  DROP CONSTRAINT IF EXISTS instance_modules_activation_policy_check,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS reconciled_at,
  DROP COLUMN IF EXISTS reconcile_id,
  DROP COLUMN IF EXISTS state_revision,
  DROP COLUMN IF EXISTS policy_revision,
  DROP COLUMN IF EXISTS manifest_version,
  DROP COLUMN IF EXISTS manual_override,
  DROP COLUMN IF EXISTS effective_active,
  DROP COLUMN IF EXISTS activation_origin,
  DROP COLUMN IF EXISTS activation_policy;
