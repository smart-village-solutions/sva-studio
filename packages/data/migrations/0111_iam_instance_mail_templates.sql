-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.server_account_invitation_templates
  DROP CONSTRAINT server_account_invitation_templates_key_chk,
  DROP CONSTRAINT server_account_invitation_templates_template_chk,
  ADD CONSTRAINT server_account_invitation_templates_key_chk CHECK (template_key IN ('account_invitation','email_verification')),
  ADD CONSTRAINT server_account_invitation_templates_template_chk CHECK (
    template IS NULL OR (
      jsonb_typeof(template)='object'
      AND template ?& ARRAY['subject','body']
      AND jsonb_typeof(template->'subject')='string'
      AND jsonb_typeof(template->'body')='string'
      AND (template_key='email_verification' OR (
        template ?& ARRAY['revision','passwordSetupLinkLabel','tenantHomepageLinkLabel']
        AND jsonb_typeof(template->'revision')='number'
        AND (template->>'revision')::integer=revision
        AND jsonb_typeof(template->'passwordSetupLinkLabel')='string'
        AND jsonb_typeof(template->'tenantHomepageLinkLabel')='string'
      ))
    )
  );
INSERT INTO iam.server_account_invitation_templates(template_key) VALUES ('email_verification');
CREATE TABLE iam.instance_mail_templates (
  instance_id text NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  template_kind text NOT NULL CHECK (template_kind IN ('invitation', 'verification')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  template jsonb CHECK (template IS NULL OR (
    jsonb_typeof(template) = 'object'
    AND template ?& ARRAY['subject','body']
    AND jsonb_typeof(template->'subject') = 'string'
    AND jsonb_typeof(template->'body') = 'string'
    AND (template_kind = 'verification' OR (
      template ?& ARRAY['revision','passwordSetupLinkLabel','tenantHomepageLinkLabel']
      AND jsonb_typeof(template->'revision') = 'number'
      AND (template->>'revision')::integer = revision AND revision > 0
      AND jsonb_typeof(template->'passwordSetupLinkLabel') = 'string'
      AND jsonb_typeof(template->'tenantHomepageLinkLabel') = 'string'
    ))
  )),
  sync_status text NOT NULL DEFAULT 'unreviewed' CHECK (sync_status IN ('unreviewed','pending','synced','failed','drift')),
  confirmed_realm text,
  confirmed_texts jsonb CHECK (confirmed_texts IS NULL OR jsonb_typeof(confirmed_texts) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (instance_id, template_kind)
);
INSERT INTO iam.instance_mail_templates (instance_id, template_kind, revision, template)
SELECT id, 'invitation', COALESCE((account_invitation_template->>'revision')::integer, 0), account_invitation_template FROM iam.instances;
INSERT INTO iam.instance_mail_templates (instance_id, template_kind)
SELECT id, 'verification' FROM iam.instances;
-- Keep the old write entry until all old app and rollback versions are retired.
-- Both versions lock the instance before its canonical invitation row.
CREATE FUNCTION iam.bridge_instance_invitation_template() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE next_revision integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_revision := COALESCE((NEW.account_invitation_template->>'revision')::integer, 0);
  ELSE
    SELECT COALESCE((SELECT revision FROM iam.instance_mail_templates
      WHERE instance_id=NEW.id AND template_kind='invitation'), 0)+1 INTO next_revision;
    IF NEW.account_invitation_template IS NOT NULL THEN
      NEW.account_invitation_template := jsonb_set(NEW.account_invitation_template, '{revision}', to_jsonb(next_revision));
    END IF;
  END IF;
  INSERT INTO iam.instance_mail_templates(instance_id,template_kind,revision,template,sync_status,updated_by)
  VALUES (NEW.id,'invitation',next_revision,NEW.account_invitation_template,
    CASE WHEN TG_OP='INSERT' THEN 'unreviewed' ELSE 'pending' END,NEW.updated_by)
  ON CONFLICT(instance_id,template_kind) DO UPDATE SET revision=EXCLUDED.revision,
    template=EXCLUDED.template,sync_status='pending',updated_by=EXCLUDED.updated_by,updated_at=now();
  RETURN NEW;
END $$;
CREATE TRIGGER instance_invitation_template_insert AFTER INSERT ON iam.instances
FOR EACH ROW EXECUTE FUNCTION iam.bridge_instance_invitation_template();
CREATE TRIGGER instance_invitation_template_update BEFORE UPDATE OF account_invitation_template ON iam.instances
FOR EACH ROW EXECUTE FUNCTION iam.bridge_instance_invitation_template();
CREATE FUNCTION iam.save_instance_invitation_template(p_instance text,p_expected integer,p_template jsonb,p_actor text)
RETURNS SETOF iam.instance_mail_templates LANGUAGE plpgsql AS $$
DECLARE current_revision integer;
BEGIN
  PERFORM 1 FROM iam.instances WHERE id=p_instance FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mail_template_revision_conflict'; END IF;
  SELECT revision INTO current_revision FROM iam.instance_mail_templates
    WHERE instance_id=p_instance AND template_kind='invitation';
  IF COALESCE(current_revision,0) <> p_expected THEN
    RAISE EXCEPTION 'mail_template_revision_conflict';
  END IF;
  UPDATE iam.instances SET account_invitation_template=p_template,updated_by=p_actor,updated_at=now()
    WHERE id=p_instance;
  RETURN QUERY SELECT * FROM iam.instance_mail_templates
    WHERE instance_id=p_instance AND template_kind='invitation';
END $$;
REVOKE ALL ON FUNCTION iam.save_instance_invitation_template(text,integer,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.save_instance_invitation_template(text,integer,jsonb,text) TO iam_app;
ALTER TABLE iam.instance_mail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_mail_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY instance_mail_templates_scope ON iam.instance_mail_templates
USING (iam.current_instance_id() IS NULL OR instance_id = iam.current_instance_id())
WITH CHECK (iam.current_instance_id() IS NULL OR instance_id = iam.current_instance_id());
GRANT SELECT, INSERT, UPDATE ON iam.instance_mail_templates TO iam_app;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sva_app') THEN
    GRANT SELECT, INSERT, UPDATE ON iam.instance_mail_templates TO sva_app;
    GRANT EXECUTE ON FUNCTION iam.save_instance_invitation_template(text,integer,jsonb,text) TO sva_app;
  END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM iam.server_account_invitation_templates WHERE template_key='email_verification';
ALTER TABLE iam.server_account_invitation_templates
  DROP CONSTRAINT server_account_invitation_templates_key_chk,
  DROP CONSTRAINT server_account_invitation_templates_template_chk,
  ADD CONSTRAINT server_account_invitation_templates_key_chk CHECK (template_key='account_invitation'),
  ADD CONSTRAINT server_account_invitation_templates_template_chk CHECK (
    template IS NULL OR (
      jsonb_typeof(template) = 'object'
      AND jsonb_typeof(template -> 'revision') = 'number'
      AND (template ->> 'revision')::integer = revision
      AND jsonb_typeof(template -> 'subject') = 'string'
      AND jsonb_typeof(template -> 'body') = 'string'
      AND jsonb_typeof(template -> 'passwordSetupLinkLabel') = 'string'
      AND jsonb_typeof(template -> 'tenantHomepageLinkLabel') = 'string'
    )
  );
DROP TRIGGER instance_invitation_template_insert ON iam.instances;
DROP TRIGGER instance_invitation_template_update ON iam.instances;
DROP FUNCTION iam.bridge_instance_invitation_template();
DROP FUNCTION iam.save_instance_invitation_template(text,integer,jsonb,text);
DROP TABLE iam.instance_mail_templates;
-- +goose StatementEnd
