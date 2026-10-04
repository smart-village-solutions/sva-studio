import type { SqlStatement } from '../iam/repositories/types.js';
import type { MediaAssetRecord } from './model-types.js';

export const upsertAssetStatement = (input: MediaAssetRecord): SqlStatement => ({
  text: `
INSERT INTO iam.media_assets (
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  metadata,
  technical,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
  $12, $13::uuid, $14, $15::uuid, $16::timestamptz
)
ON CONFLICT (id) DO UPDATE
SET storage_key = EXCLUDED.storage_key,
    media_type = EXCLUDED.media_type,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    visibility = EXCLUDED.visibility,
    upload_status = EXCLUDED.upload_status,
    processing_status = EXCLUDED.processing_status,
    metadata = EXCLUDED.metadata,
    technical = EXCLUDED.technical,
    lifecycle_status = EXCLUDED.lifecycle_status,
    provisional_operation_id = EXCLUDED.provisional_operation_id,
    provisional_owner_subject = EXCLUDED.provisional_owner_subject,
    provisional_draft_id = EXCLUDED.provisional_draft_id,
    provisional_expires_at = EXCLUDED.provisional_expires_at,
    updated_at = NOW();
`,
  values: [
    input.id,
    input.instanceId,
    input.storageKey,
    input.mediaType,
    input.mimeType,
    input.byteSize,
    input.visibility,
    input.uploadStatus,
    input.processingStatus,
    JSON.stringify(input.metadata),
    JSON.stringify(input.technical),
    input.lifecycleStatus ?? 'active',
    input.provisionalOperationId ?? null,
    input.provisionalOwnerSubject ?? null,
    input.provisionalDraftId ?? null,
    input.provisionalExpiresAt ?? null,
  ],
});

export const getAssetByIdStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND id = $2
LIMIT 1;
`,
  values: [instanceId, assetId],
});

export const getAssetByStorageKeyStatement = (
  instanceId: string,
  storageKey: string
): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND storage_key = $2
LIMIT 1
`,
  values: [instanceId, storageKey],
});

export const deleteAssetStatement = (instanceId: string, assetId: string): SqlStatement => ({
  text: `
DELETE FROM iam.media_assets
WHERE instance_id = $1
  AND id = $2;
`,
  values: [instanceId, assetId],
});

export const getProvisionalAssetByDraftStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly draftId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND lifecycle_status = 'provisional'
  AND provisional_operation_id = $2::uuid
  AND provisional_draft_id = $3::uuid
  AND provisional_owner_subject = $4
LIMIT 1;
`,
  values: [input.instanceId, input.operationId, input.draftId, input.actorSubject],
});

export const listAssetsByOperationStatement = (input: {
  readonly instanceId: string;
  readonly operationId: string;
  readonly actorSubject: string;
}): SqlStatement => ({
  text: `
SELECT
  id,
  instance_id,
  storage_key,
  media_type,
  mime_type,
  byte_size,
  visibility,
  upload_status,
  processing_status,
  lifecycle_status,
  provisional_operation_id,
  provisional_owner_subject,
  provisional_draft_id,
  provisional_expires_at,
  metadata,
  technical,
  created_at,
  updated_at
FROM iam.media_assets
WHERE instance_id = $1
  AND lifecycle_status = 'provisional'
  AND provisional_operation_id = $2::uuid
  AND provisional_owner_subject = $3
ORDER BY created_at ASC, id ASC;
`,
  values: [input.instanceId, input.operationId, input.actorSubject],
});

export const deleteVariantsByAssetIdStatement = (
  instanceId: string,
  assetId: string
): SqlStatement => ({
  text: `
DELETE FROM iam.media_variants
WHERE instance_id = $1
  AND asset_id = $2;
`,
  values: [instanceId, assetId],
});
