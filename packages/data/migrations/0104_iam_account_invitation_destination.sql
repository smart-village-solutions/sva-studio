-- +goose Up
ALTER TABLE iam.accounts
  ADD COLUMN invitation_purpose TEXT NOT NULL DEFAULT 'studio',
  ADD CONSTRAINT accounts_invitation_purpose_chk
    CHECK (invitation_purpose IN ('studio', 'ssf'));

ALTER TABLE iam.server_account_invitation_templates
  ADD COLUMN default_purpose TEXT,
  ADD CONSTRAINT server_account_invitation_templates_default_purpose_chk
    CHECK (default_purpose IS NULL OR default_purpose IN ('studio', 'ssf'));

-- +goose Down
ALTER TABLE iam.server_account_invitation_templates
  DROP CONSTRAINT server_account_invitation_templates_default_purpose_chk,
  DROP COLUMN default_purpose;

ALTER TABLE iam.accounts
  DROP CONSTRAINT accounts_invitation_purpose_chk,
  DROP COLUMN invitation_purpose;
