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
