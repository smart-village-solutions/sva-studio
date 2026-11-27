-- +goose Up
ALTER TABLE iam.media_assets
  DROP CONSTRAINT media_assets_media_type_chk,
  ADD CONSTRAINT media_assets_media_type_chk CHECK (media_type IN ('image', 'audio'));

ALTER TABLE iam.media_content_save_operations
  ADD COLUMN editorial_write_claimed_at timestamp with time zone;

-- +goose Down
-- Roll back the app image without downgrading this constraint while audio assets exist.
ALTER TABLE iam.media_content_save_operations
  DROP COLUMN editorial_write_claimed_at;

ALTER TABLE iam.media_assets
  DROP CONSTRAINT media_assets_media_type_chk,
  ADD CONSTRAINT media_assets_media_type_chk CHECK (media_type = 'image');
