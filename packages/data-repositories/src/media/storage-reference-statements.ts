import type { SqlStatement } from '../iam/repositories/types.js';
import type {
  MediaReferenceRecord,
  MediaStorageUsageRecord,
  MediaStorageUsageDelta,
  MediaStorageUsageClaim,
  MediaStorageQuotaRecord,
} from './model-types.js';

export const upsertStorageUsageStatement = (input: MediaStorageUsageRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_usage (
  instance_id,
  total_bytes,
  asset_count
)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id) DO UPDATE
SET total_bytes = EXCLUDED.total_bytes,
    asset_count = EXCLUDED.asset_count,
    updated_at = NOW();
`,
  values: [input.instanceId, input.totalBytes, input.assetCount],
});

export const applyStorageUsageDeltaStatement = (input: MediaStorageUsageDelta): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_usage (
  instance_id,
  total_bytes,
  asset_count
)
VALUES ($1, $2, $3)
ON CONFLICT (instance_id) DO UPDATE
SET total_bytes = GREATEST(iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes, 0),
    asset_count = GREATEST(iam.media_storage_usage.asset_count + EXCLUDED.asset_count, 0),
    updated_at = NOW();
`,
  values: [input.instanceId, input.totalBytesDelta, input.assetCountDelta],
});

export const tryApplyStorageUsageWithinQuotaStatement = (
  input: MediaStorageUsageClaim
): SqlStatement => ({
  text: `
WITH quota AS (
  SELECT max_bytes
  FROM iam.media_storage_quotas
  WHERE instance_id = $1
), usage_claim AS (
  INSERT INTO iam.media_storage_usage (
    instance_id,
    total_bytes,
    asset_count
  )
  SELECT $1, $2, $3
  WHERE NOT EXISTS (SELECT 1 FROM quota)
     OR $2 <= (SELECT max_bytes FROM quota)
  ON CONFLICT (instance_id) DO UPDATE
  SET total_bytes = iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes,
      asset_count = iam.media_storage_usage.asset_count + EXCLUDED.asset_count,
      updated_at = NOW()
  WHERE NOT EXISTS (SELECT 1 FROM quota)
     OR iam.media_storage_usage.total_bytes + EXCLUDED.total_bytes <= (SELECT max_bytes FROM quota)
  RETURNING instance_id
)
SELECT EXISTS(SELECT 1 FROM usage_claim) AS claimed;
`,
  values: [input.instanceId, input.totalBytes, input.assetCount],
});

export const getStorageUsageStatement = (instanceId: string): SqlStatement => ({
  text: `
SELECT
  instance_id,
  total_bytes,
  asset_count,
  updated_at
FROM iam.media_storage_usage
WHERE instance_id = $1
LIMIT 1;
`,
  values: [instanceId],
});

export const upsertStorageQuotaStatement = (input: MediaStorageQuotaRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_storage_quotas (
  instance_id,
  max_bytes
)
VALUES ($1, $2)
ON CONFLICT (instance_id) DO UPDATE
SET max_bytes = EXCLUDED.max_bytes,
    updated_at = NOW();
`,
  values: [input.instanceId, input.maxBytes],
});

export const getStorageQuotaStatement = (instanceId: string): SqlStatement => ({
  text: `
SELECT
  instance_id,
  max_bytes,
  updated_at
FROM iam.media_storage_quotas
WHERE instance_id = $1
LIMIT 1;
`,
  values: [instanceId],
});

export const deleteReferencesForTargetStatement = (
  instanceId: string,
  targetType: string,
  targetId: string
): SqlStatement => ({
  text: `
DELETE FROM iam.media_references
WHERE instance_id = $1
  AND target_type = $2
  AND target_id = $3;
`,
  values: [instanceId, targetType, targetId],
});

export const insertReferenceStatement = (
  instanceId: string,
  reference: MediaReferenceRecord
): SqlStatement => ({
  text: `
INSERT INTO iam.media_references (
  id,
  instance_id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order
)
VALUES ($1, $2, $3, $4, $5, $6, $7);
`,
  values: [
    reference.id,
    instanceId,
    reference.assetId,
    reference.targetType,
    reference.targetId,
    reference.role,
    reference.sortOrder ?? null,
  ],
});

export const listReferencesByAssetIdStatement = (
  instanceId: string,
  assetId: string
): SqlStatement => ({
  text: `
SELECT
  id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order,
  created_at
FROM iam.media_references
WHERE instance_id = $1
  AND asset_id = $2
ORDER BY created_at DESC, sort_order ASC NULLS LAST;
`,
  values: [instanceId, assetId],
});

export const listReferencesByTargetStatement = (
  instanceId: string,
  targetType: string,
  targetId: string
): SqlStatement => ({
  text: `
SELECT
  id,
  asset_id,
  target_type,
  target_id,
  role,
  sort_order,
  created_at
FROM iam.media_references
WHERE instance_id = $1
  AND target_type = $2
  AND target_id = $3
ORDER BY created_at DESC, sort_order ASC NULLS LAST;
`,
  values: [instanceId, targetType, targetId],
});
