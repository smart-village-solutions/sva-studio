-- +goose Up
ALTER TABLE iam.content_list_projection_sync_state
  ADD COLUMN snapshot_state TEXT NOT NULL DEFAULT 'empty',
  ADD COLUMN refresh_run_id UUID,
  ADD COLUMN refresh_phase TEXT,
  ADD COLUMN completed_page INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN available_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_total_final BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN skipped_invalid_count INTEGER NOT NULL DEFAULT 0;

UPDATE iam.content_list_projection_sync_state
SET snapshot_state = CASE WHEN last_succeeded_at IS NOT NULL THEN 'complete_fresh' ELSE 'empty' END,
    available_count = projected_count,
    is_total_final = last_succeeded_at IS NOT NULL;

ALTER TABLE iam.content_list_projection_sync_state
  ADD CONSTRAINT content_list_projection_sync_state_snapshot_state_chk
    CHECK (snapshot_state IN ('empty', 'partial_running', 'partial_failed', 'complete_fresh', 'complete_refreshing', 'complete_failed')),
  ADD CONSTRAINT content_list_projection_sync_state_refresh_phase_chk
    CHECK (refresh_phase IS NULL OR refresh_phase IN ('hot', 'reconciliation')),
  ADD CONSTRAINT content_list_projection_sync_state_completed_page_chk
    CHECK (completed_page >= 0),
  ADD CONSTRAINT content_list_projection_sync_state_available_count_chk
    CHECK (available_count >= 0),
  ADD CONSTRAINT content_list_projection_sync_state_skipped_invalid_count_chk
    CHECK (skipped_invalid_count >= 0);

-- +goose Down
ALTER TABLE iam.content_list_projection_sync_state
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_skipped_invalid_count_chk,
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_available_count_chk,
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_completed_page_chk,
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_refresh_phase_chk,
  DROP CONSTRAINT IF EXISTS content_list_projection_sync_state_snapshot_state_chk,
  DROP COLUMN IF EXISTS skipped_invalid_count,
  DROP COLUMN IF EXISTS is_total_final,
  DROP COLUMN IF EXISTS available_count,
  DROP COLUMN IF EXISTS completed_page,
  DROP COLUMN IF EXISTS refresh_phase,
  DROP COLUMN IF EXISTS refresh_run_id,
  DROP COLUMN IF EXISTS snapshot_state;
