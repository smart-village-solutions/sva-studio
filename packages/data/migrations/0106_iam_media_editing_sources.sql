-- +goose Up
ALTER TABLE iam.media_assets
  ADD COLUMN editing_source_asset_id uuid,
  ADD COLUMN editing_source_key text,
  ADD COLUMN editing_document jsonb,
  ADD COLUMN deletion_pending boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT media_assets_instance_id_id_key UNIQUE (instance_id, id),
  ADD CONSTRAINT media_assets_editing_source_not_self_chk
    CHECK (editing_source_asset_id IS NULL OR editing_source_asset_id <> id),
  ADD CONSTRAINT media_assets_editing_source_exclusive_chk
    CHECK (editing_source_asset_id IS NULL OR editing_source_key IS NULL),
  ADD CONSTRAINT media_assets_editing_source_private_chk
    CHECK (editing_source_key IS NULL OR
      starts_with(editing_source_key, '.protected/' || instance_id || '/') OR
      starts_with(editing_source_key, '.quarantine/' || instance_id || '/')),
  ADD CONSTRAINT media_assets_editing_document_object_chk
    CHECK (editing_document IS NULL OR jsonb_typeof(editing_document) = 'object'),
  ADD CONSTRAINT media_assets_editing_source_fkey
    FOREIGN KEY (instance_id, editing_source_asset_id)
    REFERENCES iam.media_assets (instance_id, id) ON DELETE RESTRICT;

CREATE INDEX idx_media_assets_editing_source
  ON iam.media_assets (instance_id, editing_source_asset_id)
  WHERE editing_source_asset_id IS NOT NULL;

-- +goose Down
DROP INDEX iam.idx_media_assets_editing_source;
ALTER TABLE iam.media_assets
  DROP CONSTRAINT media_assets_editing_source_fkey,
  DROP CONSTRAINT media_assets_editing_document_object_chk,
  DROP CONSTRAINT media_assets_editing_source_private_chk,
  DROP CONSTRAINT media_assets_editing_source_exclusive_chk,
  DROP CONSTRAINT media_assets_editing_source_not_self_chk,
  DROP CONSTRAINT media_assets_instance_id_id_key,
  DROP COLUMN deletion_pending,
  DROP COLUMN editing_document,
  DROP COLUMN editing_source_key,
  DROP COLUMN editing_source_asset_id;
