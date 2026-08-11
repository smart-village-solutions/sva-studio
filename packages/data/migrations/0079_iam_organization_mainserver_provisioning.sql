-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.accounts
  ADD COLUMN is_technical_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX uq_accounts_instance_id_id
  ON iam.accounts (instance_id, id);

ALTER TABLE iam.organization_mainserver_credentials
  ADD COLUMN technical_account_id UUID,
  ADD COLUMN provisioning_status TEXT NOT NULL DEFAULT 'not_provisioned',
  ADD COLUMN operation_reference TEXT,
  ADD COLUMN provisioning_phase TEXT,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN last_error_code TEXT,
  ADD COLUMN last_attempt_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN last_verified_at TIMESTAMPTZ,
  ADD CONSTRAINT organization_mainserver_credentials_technical_account_fk
    FOREIGN KEY (instance_id, technical_account_id)
    REFERENCES iam.accounts (instance_id, id)
    ON DELETE SET NULL (technical_account_id),
  ADD CONSTRAINT organization_mainserver_credentials_status_chk
    CHECK (
      provisioning_status IN (
        'not_provisioned',
        'account_ready',
        'provisioning',
        'verification_required',
        'ready',
        'failed',
        'reconciliation_required'
      )
    ),
  ADD CONSTRAINT organization_mainserver_credentials_attempt_count_chk
    CHECK (attempt_count >= 0);

CREATE INDEX organization_mainserver_credentials_technical_account_idx
  ON iam.organization_mainserver_credentials (instance_id, technical_account_id)
  WHERE technical_account_id IS NOT NULL;

CREATE INDEX organization_mainserver_credentials_active_lease_idx
  ON iam.organization_mainserver_credentials (instance_id, lease_expires_at)
  WHERE provisioning_status = 'provisioning';

UPDATE iam.organization_mainserver_credentials
SET provisioning_status = CASE
  WHEN NULLIF(btrim(mainserver_application_id), '') IS NOT NULL
    AND NULLIF(btrim(mainserver_application_secret_ciphertext), '') IS NOT NULL
    THEN 'verification_required'
  ELSE 'not_provisioned'
END;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.organization_mainserver_credentials_active_lease_idx;
DROP INDEX IF EXISTS iam.organization_mainserver_credentials_technical_account_idx;

ALTER TABLE iam.organization_mainserver_credentials
  DROP CONSTRAINT IF EXISTS organization_mainserver_credentials_attempt_count_chk,
  DROP CONSTRAINT IF EXISTS organization_mainserver_credentials_status_chk,
  DROP CONSTRAINT IF EXISTS organization_mainserver_credentials_technical_account_fk,
  DROP COLUMN IF EXISTS last_verified_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS last_attempt_at,
  DROP COLUMN IF EXISTS last_error_code,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS provisioning_phase,
  DROP COLUMN IF EXISTS operation_reference,
  DROP COLUMN IF EXISTS provisioning_status,
  DROP COLUMN IF EXISTS technical_account_id;

DROP INDEX IF EXISTS iam.uq_accounts_instance_id_id;

ALTER TABLE iam.accounts
  DROP COLUMN IF EXISTS is_technical_account;
-- +goose StatementEnd
