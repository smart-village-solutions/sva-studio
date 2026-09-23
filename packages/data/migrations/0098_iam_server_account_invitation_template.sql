-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.server_account_invitation_templates (
  template_key TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  template JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  CONSTRAINT server_account_invitation_templates_key_chk
    CHECK (template_key = 'account_invitation'),
  CONSTRAINT server_account_invitation_templates_revision_chk
    CHECK (revision >= 0),
  CONSTRAINT server_account_invitation_templates_template_chk CHECK (
    template IS NULL OR (
      jsonb_typeof(template) = 'object'
      AND jsonb_typeof(template -> 'revision') = 'number'
      AND (template ->> 'revision')::integer = revision
      AND jsonb_typeof(template -> 'subject') = 'string'
      AND jsonb_typeof(template -> 'body') = 'string'
      AND jsonb_typeof(template -> 'passwordSetupLinkLabel') = 'string'
      AND jsonb_typeof(template -> 'tenantHomepageLinkLabel') = 'string'
    )
  )
);

INSERT INTO iam.server_account_invitation_templates (template_key)
VALUES ('account_invitation');

ALTER TABLE iam.server_account_invitation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.server_account_invitation_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY server_account_invitation_templates_platform_scope
  ON iam.server_account_invitation_templates
  USING (iam.current_instance_id() IS NULL)
  WITH CHECK (iam.current_instance_id() IS NULL);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS iam.server_account_invitation_templates;
-- +goose StatementEnd
