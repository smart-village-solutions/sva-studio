-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.content_history
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS coverage TEXT NOT NULL DEFAULT 'studio_mutations',
  ADD COLUMN IF NOT EXISTS mutation_ref TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_history_origin_chk' AND conrelid = 'iam.content_history'::regclass) THEN
    ALTER TABLE iam.content_history ADD CONSTRAINT content_history_origin_chk CHECK (origin = 'studio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_history_coverage_chk' AND conrelid = 'iam.content_history'::regclass) THEN
    ALTER TABLE iam.content_history ADD CONSTRAINT content_history_coverage_chk CHECK (coverage = 'studio_mutations');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS iam_content_history_mutation_ref_idx
  ON iam.content_history (instance_id, content_id, mutation_ref)
  WHERE mutation_ref IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.iam_content_history_mutation_ref_idx;
ALTER TABLE iam.content_history
  DROP CONSTRAINT IF EXISTS content_history_coverage_chk,
  DROP CONSTRAINT IF EXISTS content_history_origin_chk,
  DROP COLUMN IF EXISTS mutation_ref,
  DROP COLUMN IF EXISTS coverage,
  DROP COLUMN IF EXISTS origin;
-- +goose StatementEnd
