-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.media_content_save_operations (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  actor_subject TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'preparing',
  error_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_content_save_operations_status_chk CHECK (
    status IN (
      'preparing',
      'uploading',
      'saving_content',
      'content_saved',
      'committed',
      'abandon_pending',
      'abandoned',
      'outcome_unknown',
      'reconciliation_required'
    )
  ),
  CONSTRAINT media_content_save_operations_target_chk CHECK (
    (status IN ('content_saved', 'committed') AND target_id IS NOT NULL)
    OR status NOT IN ('content_saved', 'committed')
  )
);

CREATE INDEX IF NOT EXISTS idx_media_content_save_operations_instance_status
  ON iam.media_content_save_operations(instance_id, status, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_media_content_save_operations_recovery
  ON iam.media_content_save_operations(expires_at, updated_at ASC)
  WHERE status IN ('preparing', 'uploading', 'saving_content', 'abandon_pending');

ALTER TABLE iam.media_assets
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS provisional_operation_id UUID,
  ADD COLUMN IF NOT EXISTS provisional_owner_subject TEXT,
  ADD COLUMN IF NOT EXISTS provisional_draft_id UUID,
  ADD COLUMN IF NOT EXISTS provisional_expires_at TIMESTAMPTZ;

ALTER TABLE iam.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_lifecycle_status_chk,
  ADD CONSTRAINT media_assets_lifecycle_status_chk
    CHECK (lifecycle_status IN ('provisional', 'active'));

ALTER TABLE iam.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_provisional_ownership_chk,
  ADD CONSTRAINT media_assets_provisional_ownership_chk CHECK (
    (
      lifecycle_status = 'active'
      AND provisional_operation_id IS NULL
      AND provisional_owner_subject IS NULL
      AND provisional_draft_id IS NULL
      AND provisional_expires_at IS NULL
    )
    OR (
      lifecycle_status = 'provisional'
      AND provisional_operation_id IS NOT NULL
      AND provisional_owner_subject IS NOT NULL
      AND provisional_draft_id IS NOT NULL
      AND provisional_expires_at IS NOT NULL
    )
  );

ALTER TABLE iam.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_provisional_operation_id_fkey,
  ADD CONSTRAINT media_assets_provisional_operation_id_fkey
    FOREIGN KEY (provisional_operation_id)
    REFERENCES iam.media_content_save_operations(id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_provisional_draft
  ON iam.media_assets(instance_id, provisional_operation_id, provisional_draft_id)
  WHERE lifecycle_status = 'provisional';

CREATE INDEX IF NOT EXISTS idx_media_assets_provisional_expiry
  ON iam.media_assets(provisional_expires_at, updated_at ASC)
  WHERE lifecycle_status = 'provisional';

CREATE TABLE IF NOT EXISTS iam.media_content_save_operation_references (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL REFERENCES iam.media_content_save_operations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES iam.media_assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_content_save_operation_references_sort_order_chk
    CHECK (sort_order IS NULL OR sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_content_save_operation_reference_position
  ON iam.media_content_save_operation_references(operation_id, role, sort_order)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_media_content_save_operation_references_asset
  ON iam.media_content_save_operation_references(instance_id, asset_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_media_content_save_operation_references_asset;
DROP INDEX IF EXISTS iam.idx_media_content_save_operation_reference_position;
DROP TABLE IF EXISTS iam.media_content_save_operation_references;

DROP INDEX IF EXISTS iam.idx_media_assets_provisional_expiry;
DROP INDEX IF EXISTS iam.idx_media_assets_provisional_draft;
ALTER TABLE iam.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_provisional_operation_id_fkey,
  DROP CONSTRAINT IF EXISTS media_assets_provisional_ownership_chk,
  DROP CONSTRAINT IF EXISTS media_assets_lifecycle_status_chk,
  DROP COLUMN IF EXISTS provisional_expires_at,
  DROP COLUMN IF EXISTS provisional_draft_id,
  DROP COLUMN IF EXISTS provisional_owner_subject,
  DROP COLUMN IF EXISTS provisional_operation_id,
  DROP COLUMN IF EXISTS lifecycle_status;

DROP INDEX IF EXISTS iam.idx_media_content_save_operations_recovery;
DROP INDEX IF EXISTS iam.idx_media_content_save_operations_instance_status;
DROP TABLE IF EXISTS iam.media_content_save_operations;
-- +goose StatementEnd
