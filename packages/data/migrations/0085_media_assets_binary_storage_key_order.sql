-- +goose Up
CREATE INDEX IF NOT EXISTS idx_media_assets_active_storage_key_binary
  ON iam.media_assets(instance_id, storage_key COLLATE "C")
  WHERE lifecycle_status = 'active';

-- +goose Down
DROP INDEX IF EXISTS iam.idx_media_assets_active_storage_key_binary;
