-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN account_invitation_template JSONB,
  ADD CONSTRAINT instances_account_invitation_template_chk CHECK (
    account_invitation_template IS NULL OR (
      jsonb_typeof(account_invitation_template) = 'object'
      AND jsonb_typeof(account_invitation_template -> 'revision') = 'number'
      AND (account_invitation_template ->> 'revision')::integer > 0
      AND jsonb_typeof(account_invitation_template -> 'subject') = 'string'
      AND jsonb_typeof(account_invitation_template -> 'body') = 'string'
      AND jsonb_typeof(account_invitation_template -> 'passwordSetupLinkLabel') = 'string'
      AND jsonb_typeof(account_invitation_template -> 'tenantHomepageLinkLabel') = 'string'
    )
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  DROP CONSTRAINT IF EXISTS instances_account_invitation_template_chk,
  DROP COLUMN IF EXISTS account_invitation_template;
-- +goose StatementEnd
