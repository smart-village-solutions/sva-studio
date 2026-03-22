UPDATE iam.legal_text_versions
SET published_at = COALESCE(published_at, updated_at, created_at, NOW())
WHERE published_at IS NULL;

ALTER TABLE iam.legal_text_versions
  ALTER COLUMN published_at SET NOT NULL;

ALTER TABLE iam.legal_text_versions
  DROP CONSTRAINT IF EXISTS legal_text_versions_status_chk;

ALTER TABLE iam.legal_text_versions
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS content_html,
  DROP COLUMN IF EXISTS name;
