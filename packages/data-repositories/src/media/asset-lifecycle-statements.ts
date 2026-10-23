import type { SqlStatement } from '../iam/repositories/types.js';
import { getAssetByIdStatement } from './asset-statements.js';

export const lockAssetByIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  ...getAssetByIdStatement(instanceId, assetId),
  text: getAssetByIdStatement(instanceId, assetId).text.replace('LIMIT 1;', 'LIMIT 1 FOR UPDATE;'),
});

export const listEditingCopiesStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT id, metadata
FROM iam.media_assets
WHERE instance_id = $1 AND editing_source_asset_id = $2
  AND lifecycle_status = 'active'
ORDER BY created_at, id;
`,
  values: [instanceId, assetId],
});

// Called after locking the asset, as a separate statement so a waited-on copy commit
// is visible under READ COMMITTED before any Storage I/O can begin.
export const claimAssetDeletionStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
UPDATE iam.media_assets AS asset
SET deletion_pending = true, updated_at = NOW()
WHERE asset.instance_id = $1 AND asset.id = $2
  AND asset.lifecycle_status = 'active'
  AND (
    (asset.upload_status = 'processed' AND asset.processing_status = 'ready')
    OR (asset.upload_status IN ('failed', 'blocked') AND asset.processing_status = 'failed')
    OR (asset.upload_status = 'pending' AND asset.processing_status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM iam.media_upload_sessions AS session
        WHERE session.instance_id = $1 AND session.asset_id = $2
          AND (session.status <> 'pending' OR session.expires_at IS NULL OR session.expires_at > NOW())
      ))
  )
  AND NOT EXISTS (
    SELECT 1 FROM iam.media_references
    WHERE instance_id = $1 AND asset_id = $2
  )
  AND NOT EXISTS (
    SELECT 1 FROM iam.media_content_save_operation_references
    WHERE instance_id = $1 AND asset_id = $2
  )
  AND NOT EXISTS (
    SELECT 1 FROM iam.media_assets AS copy
    WHERE copy.instance_id = $1 AND copy.editing_source_asset_id = $2
  )
RETURNING asset.id;
`,
  values: [instanceId, assetId],
});

export const finalizeAssetDeletionStatement = (
  instanceId: string,
  assetId: string
): SqlStatement => ({
  text: `
WITH deleted AS (
  DELETE FROM iam.media_assets
  WHERE instance_id = $1 AND id = $2 AND deletion_pending = true
  RETURNING byte_size, technical, upload_status, processing_status
), corrected AS (
  UPDATE iam.media_storage_usage AS usage
  SET total_bytes = GREATEST(0, usage.total_bytes - deleted.byte_size
        - COALESCE((deleted.technical->>'variantBytes')::bigint,
                   (deleted.technical->>'variantTotalBytes')::bigint, 0)
        - COALESCE((deleted.technical->>'editingSourceBytes')::bigint, 0)
        - COALESCE((deleted.technical->>'editingDocumentBytes')::bigint, 0)),
      asset_count = GREATEST(0, usage.asset_count - 1), updated_at = NOW()
  FROM deleted
  WHERE usage.instance_id = $1 AND deleted.upload_status = 'processed' AND deleted.processing_status = 'ready'
  RETURNING usage.instance_id
)
SELECT EXISTS(SELECT 1 FROM deleted) AS deleted;
`,
  values: [instanceId, assetId],
});
