-- +goose Up
ALTER TABLE iam.app_translation_catalog_drafts
  ADD COLUMN IF NOT EXISTS machine_standard_values_by_locale JSONB NOT NULL DEFAULT '{}'
  CHECK (jsonb_typeof(machine_standard_values_by_locale) = 'object');

-- +goose Down
-- Retain generated standards on rollback, just like existing catalog and provider data.
-- Older runtimes ignore this additive column; reapplying Up keeps its contents.
SELECT 1;
