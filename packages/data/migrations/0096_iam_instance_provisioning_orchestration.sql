-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_provisioning_runs
  ADD COLUMN snapshot_version TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN desired_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN child_keycloak_run_id UUID REFERENCES iam.instance_keycloak_provisioning_runs(id) ON DELETE SET NULL,
  ADD COLUMN lease_owner TEXT,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN deadline_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  ADD COLUMN terminal_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD CONSTRAINT instance_provisioning_attempt_count_chk CHECK (attempt_count >= 0),
  ADD CONSTRAINT instance_provisioning_lease_pair_chk CHECK (
    (lease_owner IS NULL) = (lease_expires_at IS NULL)
  ),
  ADD CONSTRAINT instance_provisioning_completion_chk CHECK (
    (status IN ('active', 'failed', 'suspended', 'archived')) = (completed_at IS NOT NULL)
  ) NOT VALID;

CREATE INDEX idx_instance_provisioning_runs_claim
  ON iam.instance_provisioning_runs(next_attempt_at, created_at, id)
  WHERE operation = 'create'
    AND snapshot_version = '2.0'
    AND status IN ('requested', 'validated', 'provisioning');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_instance_provisioning_runs_claim;

ALTER TABLE iam.instance_provisioning_runs
  DROP CONSTRAINT IF EXISTS instance_provisioning_completion_chk,
  DROP CONSTRAINT IF EXISTS instance_provisioning_lease_pair_chk,
  DROP CONSTRAINT IF EXISTS instance_provisioning_attempt_count_chk,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS terminal_evidence,
  DROP COLUMN IF EXISTS deadline_at,
  DROP COLUMN IF EXISTS next_attempt_at,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS lease_owner,
  DROP COLUMN IF EXISTS child_keycloak_run_id,
  DROP COLUMN IF EXISTS desired_snapshot,
  DROP COLUMN IF EXISTS snapshot_version;
-- +goose StatementEnd
