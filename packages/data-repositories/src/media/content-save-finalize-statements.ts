import type { SqlStatement } from '../iam/repositories/types.js';

export const markContentSaveOperationAbandonPendingStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly errorCode?: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations
SET status = 'abandon_pending',
    error_code = $4,
    updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
  AND status IN ('preparing', 'uploading', 'saving_content', 'abandon_pending')
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject, input.errorCode ?? null],
});

export const finalizeContentSaveOperationAbandonedStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
UPDATE iam.media_content_save_operations AS operation
SET status = 'abandoned',
    updated_at = NOW()
WHERE operation.id = $1::uuid
  AND operation.instance_id = $2
  AND operation.actor_subject = $3
  AND operation.status IN ('abandon_pending', 'abandoned')
  AND NOT EXISTS (
    SELECT 1
    FROM iam.media_assets AS asset
    WHERE asset.provisional_operation_id = operation.id
  )
RETURNING id;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

export const claimContentSaveOperationRecoveryStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly leaseOwner: string;
  readonly leaseExpiresAt: string;
  readonly now: string;
}): SqlStatement => ({
  text: `
WITH reconciled AS (
  UPDATE iam.media_content_save_operations
  SET status = 'reconciliation_required',
      error_code = COALESCE(error_code, 'content_save_interrupted'),
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
  WHERE id = $1::uuid
    AND instance_id = $2
    AND status = 'saving_content'
    AND expires_at <= $5::timestamptz
  RETURNING id
), claimed AS (
  UPDATE iam.media_content_save_operations
  SET status = 'abandon_pending',
      error_code = COALESCE(error_code, 'content_save_expired'),
      lease_owner = $3,
      lease_expires_at = $4::timestamptz,
      updated_at = NOW()
  WHERE id = $1::uuid
    AND instance_id = $2
    AND status IN ('preparing', 'uploading', 'abandon_pending')
    AND expires_at <= $5::timestamptz
    AND (
      lease_owner = $3
      OR lease_expires_at IS NULL
      OR lease_expires_at <= $5::timestamptz
    )
    AND NOT EXISTS (SELECT 1 FROM reconciled)
  RETURNING
    id,
    instance_id,
    actor_subject,
    target_type,
    target_id,
    status,
    error_code,
    expires_at,
    created_at,
    updated_at
)
SELECT * FROM claimed;
`,
  values: [input.operationId, input.instanceId, input.leaseOwner, input.leaseExpiresAt, input.now],
});

export const finalizeContentSaveOperationCleanupStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
WITH eligible_operation AS (
  SELECT id, instance_id
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND actor_subject = $3
    AND status IN ('abandon_pending', 'abandoned')
  FOR UPDATE
), deleted_operation_references AS (
  DELETE FROM iam.media_content_save_operation_references
  WHERE operation_id IN (SELECT id FROM eligible_operation)
  RETURNING id
), deleted_assets AS (
  DELETE FROM iam.media_assets AS asset
  USING eligible_operation
  WHERE asset.instance_id = eligible_operation.instance_id
    AND asset.provisional_operation_id = eligible_operation.id
    AND asset.lifecycle_status = 'provisional'
  RETURNING
    asset.byte_size,
    CASE
      WHEN COALESCE(asset.technical->>'variantBytes', '') ~ '^[0-9]+$'
        THEN (asset.technical->>'variantBytes')::bigint
      ELSE 0
    END AS variant_bytes
), deleted_totals AS (
  SELECT
    COUNT(*)::integer AS asset_count,
    COALESCE(SUM(byte_size + variant_bytes), 0)::bigint AS total_bytes
  FROM deleted_assets
), usage_updated AS (
  UPDATE iam.media_storage_usage AS usage
  SET total_bytes = GREATEST(0, usage.total_bytes - deleted_totals.total_bytes),
      asset_count = GREATEST(0, usage.asset_count - deleted_totals.asset_count),
      updated_at = NOW()
  FROM deleted_totals
  WHERE usage.instance_id = $2
    AND deleted_totals.asset_count > 0
  RETURNING usage.instance_id
), finalized AS (
  UPDATE iam.media_content_save_operations AS operation
  SET status = 'abandoned',
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
  WHERE operation.id IN (SELECT id FROM eligible_operation)
    AND NOT EXISTS (
      SELECT 1
      FROM iam.media_assets AS asset
      WHERE asset.provisional_operation_id = operation.id
    )
    AND (SELECT COUNT(*) FROM deleted_operation_references) >= 0
    AND (SELECT COUNT(*) FROM usage_updated) >= 0
  RETURNING operation.id
)
SELECT EXISTS(SELECT 1 FROM finalized) AS successful;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});
