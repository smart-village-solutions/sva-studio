-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS realm_mode TEXT NOT NULL DEFAULT 'new';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_realm_mode_chk'
      AND conrelid = 'iam.instances'::regclass
  ) THEN
    ALTER TABLE iam.instances
      ADD CONSTRAINT instances_realm_mode_chk CHECK (realm_mode IN ('new', 'existing'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iam.instance_keycloak_provisioning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  intent TEXT NOT NULL,
  overall_status TEXT NOT NULL,
  drift_summary TEXT NOT NULL DEFAULT '',
  request_id TEXT,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instance_keycloak_provisioning_runs_mode_chk CHECK (mode IN ('new', 'existing')),
  CONSTRAINT instance_keycloak_provisioning_runs_intent_chk CHECK (
    intent IN ('provision', 'reset_tenant_admin', 'rotate_client_secret')
  ),
  CONSTRAINT instance_keycloak_provisioning_runs_status_chk CHECK (
    overall_status IN ('planned', 'running', 'succeeded', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_instance_keycloak_provisioning_runs_instance_created
  ON iam.instance_keycloak_provisioning_runs(instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.instance_keycloak_provisioning_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES iam.instance_keycloak_provisioning_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  summary TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instance_keycloak_provisioning_steps_status_chk CHECK (
    status IN ('pending', 'running', 'done', 'failed', 'skipped', 'unchanged')
  )
);

CREATE INDEX IF NOT EXISTS idx_instance_keycloak_provisioning_steps_run_created
  ON iam.instance_keycloak_provisioning_steps(run_id, created_at ASC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_instance_keycloak_provisioning_steps_run_created;
DROP TABLE IF EXISTS iam.instance_keycloak_provisioning_steps;

DROP INDEX IF EXISTS iam.idx_instance_keycloak_provisioning_runs_instance_created;
DROP TABLE IF EXISTS iam.instance_keycloak_provisioning_runs;

ALTER TABLE IF EXISTS iam.instances
  DROP CONSTRAINT IF EXISTS instances_realm_mode_chk,
  DROP COLUMN IF EXISTS realm_mode;
-- +goose StatementEnd
