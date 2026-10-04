-- +goose Up
ALTER TABLE iam.content_list_projection_sync_state
  ADD COLUMN generation BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN completed_generation BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN snapshot_invalidated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE iam.content_list_projection_sync_state
  ADD CONSTRAINT content_list_projection_sync_state_generation_chk CHECK (generation >= 0),
  ADD CONSTRAINT content_list_projection_sync_state_completed_generation_chk CHECK (completed_generation >= 0);

-- +goose Down
ALTER TABLE iam.content_list_projection_sync_state
  DROP CONSTRAINT content_list_projection_sync_state_completed_generation_chk,
  DROP CONSTRAINT content_list_projection_sync_state_generation_chk,
  DROP COLUMN snapshot_invalidated,
  DROP COLUMN completed_generation,
  DROP COLUMN generation;
