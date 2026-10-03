import type { SqlStatement } from '../iam/repositories/types.js';
import type {
  MediaContentSaveOperationRecord,
  MediaContentSaveOperationReference,
} from './model-types.js';

export const createContentSaveOperationStatement = (
  input: MediaContentSaveOperationRecord
): SqlStatement => ({
  text: `
INSERT INTO iam.media_content_save_operations (
  id,
  instance_id,
  actor_subject,
  target_type,
  target_id,
  status,
  error_code,
  expires_at
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz)
ON CONFLICT (id) DO UPDATE
SET updated_at = iam.media_content_save_operations.updated_at
WHERE iam.media_content_save_operations.instance_id = EXCLUDED.instance_id
  AND iam.media_content_save_operations.actor_subject = EXCLUDED.actor_subject
  AND iam.media_content_save_operations.target_type = EXCLUDED.target_type
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
  updated_at;
`,
  values: [
    input.id,
    input.instanceId,
    input.actorSubject,
    input.targetType,
    input.targetId ?? null,
    input.status,
    input.errorCode ?? null,
    input.expiresAt,
  ],
});

export const getContentSaveOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
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
FROM iam.media_content_save_operations
WHERE id = $1::uuid
  AND instance_id = $2
  AND actor_subject = $3
LIMIT 1;
`,
  values: [input.operationId, input.instanceId, input.actorSubject],
});

export const lockOpenContentSaveOperationForUploadStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
}): SqlStatement => ({
  text: `
SELECT EXISTS (
  SELECT 1
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND status IN ('preparing', 'uploading')
  FOR UPDATE
) AS open;
`,
  values: [input.operationId, input.instanceId],
});

export const replaceContentSaveOperationReferencesStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
  readonly references: readonly MediaContentSaveOperationReference[];
}): SqlStatement => ({
  text: `
WITH eligible_operation AS (
  SELECT id
  FROM iam.media_content_save_operations
  WHERE id = $1::uuid
    AND instance_id = $2
    AND actor_subject = $3
    AND status IN ('preparing', 'uploading', 'saving_content', 'abandon_pending')
  FOR UPDATE
), deleted AS (
  DELETE FROM iam.media_content_save_operation_references
  WHERE operation_id IN (SELECT id FROM eligible_operation)
  RETURNING id
), desired AS (
  SELECT
    input.id,
    input.asset_id,
    input.role,
    NULLIF(input.sort_order, '')::integer AS sort_order
  FROM unnest($4::uuid[], $5::uuid[], $6::text[], $7::text[])
    AS input(id, asset_id, role, sort_order)
), inserted AS (
  INSERT INTO iam.media_content_save_operation_references (
    id,
    instance_id,
    operation_id,
    asset_id,
    role,
    sort_order
  )
  SELECT
    desired.id,
    $2,
    eligible_operation.id,
    desired.asset_id,
    desired.role,
    desired.sort_order
  FROM desired
  CROSS JOIN eligible_operation
  CROSS JOIN (SELECT COUNT(*) FROM deleted) AS deletion_barrier
  JOIN iam.media_assets AS asset
    ON asset.id = desired.asset_id
   AND asset.instance_id = $2
   AND (
     asset.lifecycle_status = 'active'
     OR (
       asset.lifecycle_status = 'provisional'
       AND asset.provisional_operation_id = eligible_operation.id
       AND asset.provisional_owner_subject = $3
     )
   )
  RETURNING id
), updated AS (
  UPDATE iam.media_content_save_operations
  SET status = CASE WHEN status = 'preparing' THEN 'uploading' ELSE status END,
      updated_at = NOW()
  WHERE id IN (SELECT id FROM eligible_operation)
    AND (SELECT COUNT(*) FROM inserted) = cardinality($4::uuid[])
  RETURNING id
)
SELECT EXISTS(SELECT 1 FROM updated) AS successful;
`,
  values: [
    input.operationId,
    input.instanceId,
    input.actorSubject,
    input.references.map(({ id }) => id),
    input.references.map(({ assetId }) => assetId),
    input.references.map(({ role }) => role),
    input.references.map(({ sortOrder }) => sortOrder?.toString() ?? ''),
  ],
});
