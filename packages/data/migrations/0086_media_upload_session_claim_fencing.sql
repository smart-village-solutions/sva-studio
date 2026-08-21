-- +goose Up
ALTER TABLE iam.media_upload_sessions
  ADD COLUMN IF NOT EXISTS claim_token UUID;

-- +goose Down
ALTER TABLE iam.media_upload_sessions
  DROP COLUMN IF EXISTS claim_token;
