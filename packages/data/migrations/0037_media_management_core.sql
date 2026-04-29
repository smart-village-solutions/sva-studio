-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.media_assets (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  media_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  visibility TEXT NOT NULL,
  upload_status TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  technical JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_assets_media_type_chk CHECK (media_type IN ('image')),
  CONSTRAINT media_assets_visibility_chk CHECK (visibility IN ('public', 'protected')),
  CONSTRAINT media_assets_upload_status_chk CHECK (upload_status IN ('pending', 'validated', 'processed', 'failed', 'blocked')),
  CONSTRAINT media_assets_processing_status_chk CHECK (processing_status IN ('pending', 'ready', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_instance_storage_key
  ON iam.media_assets(instance_id, storage_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_instance_updated_at
  ON iam.media_assets(instance_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_instance_visibility_updated_at
  ON iam.media_assets(instance_id, visibility, updated_at DESC);

CREATE TABLE IF NOT EXISTS iam.media_variants (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES iam.media_assets(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  format TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER,
  storage_key TEXT NOT NULL,
  generation_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_variants_generation_status_chk CHECK (generation_status IN ('pending', 'ready', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_variants_asset_variant_key
  ON iam.media_variants(asset_id, variant_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_variants_instance_storage_key
  ON iam.media_variants(instance_id, storage_key);
CREATE INDEX IF NOT EXISTS idx_media_variants_instance_asset
  ON iam.media_variants(instance_id, asset_id, created_at ASC);

CREATE TABLE IF NOT EXISTS iam.media_upload_sessions (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES iam.media_assets(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_upload_sessions_status_chk CHECK (status IN ('pending', 'uploaded', 'validated', 'failed', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_upload_sessions_instance_storage_key
  ON iam.media_upload_sessions(instance_id, storage_key);
CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_instance_asset
  ON iam.media_upload_sessions(instance_id, asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.media_storage_usage (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  asset_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam.media_storage_quotas (
  instance_id TEXT PRIMARY KEY REFERENCES iam.instances(id) ON DELETE CASCADE,
  max_bytes BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_storage_quotas_max_bytes_chk CHECK (max_bytes > 0)
);

CREATE TABLE IF NOT EXISTS iam.media_references (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES iam.media_assets(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_references_asset_id
  ON iam.media_references(instance_id, asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_references_target
  ON iam.media_references(instance_id, target_type, target_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_media_references_target;
DROP INDEX IF EXISTS iam.idx_media_references_asset_id;
DROP TABLE IF EXISTS iam.media_references;
DROP TABLE IF EXISTS iam.media_storage_quotas;
DROP TABLE IF EXISTS iam.media_storage_usage;
DROP INDEX IF EXISTS iam.idx_media_upload_sessions_instance_asset;
DROP INDEX IF EXISTS iam.idx_media_upload_sessions_instance_storage_key;
DROP TABLE IF EXISTS iam.media_upload_sessions;
DROP INDEX IF EXISTS iam.idx_media_variants_instance_asset;
DROP INDEX IF EXISTS iam.idx_media_variants_instance_storage_key;
DROP INDEX IF EXISTS iam.idx_media_variants_asset_variant_key;
DROP TABLE IF EXISTS iam.media_variants;
DROP INDEX IF EXISTS iam.idx_media_assets_instance_visibility_updated_at;
DROP INDEX IF EXISTS iam.idx_media_assets_instance_updated_at;
DROP INDEX IF EXISTS iam.idx_media_assets_instance_storage_key;
DROP TABLE IF EXISTS iam.media_assets;
-- +goose StatementEnd
