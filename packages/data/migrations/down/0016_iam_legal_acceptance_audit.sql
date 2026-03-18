DROP INDEX IF EXISTS iam.idx_legal_text_acceptances_subject;
DROP INDEX IF EXISTS iam.idx_legal_text_acceptances_workspace_action;

ALTER TABLE iam.legal_text_acceptances
  DROP CONSTRAINT IF EXISTS legal_text_acceptances_action_type_chk;

ALTER TABLE iam.legal_text_acceptances
  DROP COLUMN IF EXISTS action_type,
  DROP COLUMN IF EXISTS legal_text_version,
  DROP COLUMN IF EXISTS subject_id,
  DROP COLUMN IF EXISTS workspace_id;
