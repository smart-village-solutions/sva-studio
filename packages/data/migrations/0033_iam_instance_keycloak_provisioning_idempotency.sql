-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_keycloak_provisioning_runs
  ADD COLUMN IF NOT EXISTS mutation TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instance_keycloak_provisioning_runs_idempotency_complete_chk'
      AND conrelid = 'iam.instance_keycloak_provisioning_runs'::regclass
  ) THEN
    ALTER TABLE iam.instance_keycloak_provisioning_runs
      ADD CONSTRAINT instance_keycloak_provisioning_runs_idempotency_complete_chk CHECK (
        (mutation IS NULL AND idempotency_key IS NULL AND payload_fingerprint IS NULL)
        OR (mutation IS NOT NULL AND idempotency_key IS NOT NULL AND payload_fingerprint IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_keycloak_provisioning_runs_idempotency
  ON iam.instance_keycloak_provisioning_runs(instance_id, mutation, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instance_keycloak_provisioning_runs_idempotency_lookup
  ON iam.instance_keycloak_provisioning_runs(instance_id, mutation, idempotency_key, payload_fingerprint)
  WHERE idempotency_key IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_instance_keycloak_provisioning_runs_idempotency_lookup;
DROP INDEX IF EXISTS iam.idx_instance_keycloak_provisioning_runs_idempotency;

ALTER TABLE IF EXISTS iam.instance_keycloak_provisioning_runs
  DROP CONSTRAINT IF EXISTS instance_keycloak_provisioning_runs_idempotency_complete_chk,
  DROP COLUMN IF EXISTS payload_fingerprint,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS mutation;
-- +goose StatementEnd
