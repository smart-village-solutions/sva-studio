ALTER TABLE iam.legal_text_versions
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS content_html TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE iam.legal_text_versions
SET
  name = COALESCE(NULLIF(TRIM(name), ''), legal_text_id),
  content_html = COALESCE(content_html, '<p></p>'),
  status = COALESCE(status, CASE WHEN is_active THEN 'valid' ELSE 'draft' END),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE name IS NULL
   OR content_html IS NULL
   OR status IS NULL
   OR updated_at IS NULL;

ALTER TABLE iam.legal_text_versions
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN published_at DROP NOT NULL,
  ALTER COLUMN content_html SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'legal_text_versions_status_chk'
      AND conrelid = 'iam.legal_text_versions'::regclass
  ) THEN
    ALTER TABLE iam.legal_text_versions
      ADD CONSTRAINT legal_text_versions_status_chk
      CHECK (status IN ('draft', 'valid', 'archived'));
  END IF;
END $$;
