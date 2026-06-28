-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.content_list_projection
  ADD COLUMN IF NOT EXISTS source_data_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS source_data_provider_name TEXT,
  ADD COLUMN IF NOT EXISTS credential_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_list_projection_credential_source_chk'
      AND conrelid = 'iam.content_list_projection'::regclass
  ) THEN
    ALTER TABLE iam.content_list_projection
      ADD CONSTRAINT content_list_projection_credential_source_chk
      CHECK (credential_source IS NULL OR credential_source IN ('organization', 'user'));
  END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.content_list_projection
  DROP CONSTRAINT IF EXISTS content_list_projection_credential_source_chk;

ALTER TABLE iam.content_list_projection
  DROP COLUMN IF EXISTS credential_source,
  DROP COLUMN IF EXISTS source_data_provider_name,
  DROP COLUMN IF EXISTS source_data_provider_id;
-- +goose StatementEnd
