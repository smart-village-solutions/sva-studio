-- +goose Up
-- +goose StatementBegin
-- Migration 0016: Legal-Text-Acceptance Audit-Felder (Paket 5)
-- Ergänzt die bestehende Tabelle iam.legal_text_acceptances um Pflichtfelder
-- für Compliance-Export und revisionssichere Nachweise.

ALTER TABLE iam.legal_text_acceptances
  ADD COLUMN IF NOT EXISTS workspace_id     TEXT,
  ADD COLUMN IF NOT EXISTS subject_id       TEXT,
  ADD COLUMN IF NOT EXISTS legal_text_version TEXT,
  ADD COLUMN IF NOT EXISTS action_type      TEXT NOT NULL DEFAULT 'accepted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_text_acceptances_action_type_chk'
      AND conrelid = 'iam.legal_text_acceptances'::regclass
  ) THEN
    ALTER TABLE iam.legal_text_acceptances
      ADD CONSTRAINT legal_text_acceptances_action_type_chk
      CHECK (action_type IN ('accepted', 'revoked', 'prompted'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_workspace_action
  ON iam.legal_text_acceptances(workspace_id, action_type)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_text_acceptances_subject
  ON iam.legal_text_acceptances(subject_id)
  WHERE subject_id IS NOT NULL;

-- Permission für Legal-Consent-Export (falls noch nicht vorhanden)
-- Wird in den IAM-Seed-Plan integriert; diese Aussage dient als Referenz.
-- INSERT INTO iam.permissions (instance_id, permission_key, action, resource_type, effect, description)
-- wird über den idempotenten Seed-Plan eingespielt, nicht direkt hier.
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_legal_text_acceptances_subject;
DROP INDEX IF EXISTS iam.idx_legal_text_acceptances_workspace_action;

ALTER TABLE iam.legal_text_acceptances
  DROP CONSTRAINT IF EXISTS legal_text_acceptances_action_type_chk;

ALTER TABLE iam.legal_text_acceptances
  DROP COLUMN IF EXISTS action_type,
  DROP COLUMN IF EXISTS legal_text_version,
  DROP COLUMN IF EXISTS subject_id,
  DROP COLUMN IF EXISTS workspace_id;
-- +goose StatementEnd
