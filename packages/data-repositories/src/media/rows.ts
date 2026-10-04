import type {
  MediaAssetRecord,
  MediaContentSaveOperationRecord,
  MediaReferenceRecord,
  MediaVariantRecord,
  MediaUploadSessionRecord,
  MediaStorageUsageRecord,
  MediaStorageQuotaRecord,
} from './model-types.js';
import type {
  MediaAssetRow,
  MediaContentSaveOperationRow,
  MediaReferenceRow,
  MediaVariantRow,
  MediaUploadSessionRow,
  MediaStorageUsageRow,
  MediaStorageQuotaRow,
} from './row-types.js';
export type * from './row-types.js';

export const mapAssetRow = (row: MediaAssetRow): MediaAssetRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  storageKey: row.storage_key,
  mediaType: row.media_type,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  visibility: row.visibility,
  uploadStatus: row.upload_status,
  processingStatus: row.processing_status,
  lifecycleStatus: row.lifecycle_status,
  provisionalOperationId: row.provisional_operation_id ?? undefined,
  provisionalOwnerSubject: row.provisional_owner_subject ?? undefined,
  provisionalDraftId: row.provisional_draft_id ?? undefined,
  provisionalExpiresAt: row.provisional_expires_at ?? undefined,
  metadata: row.metadata ?? {},
  technical: row.technical ?? {},
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

export const mapContentSaveOperationRow = (
  row: MediaContentSaveOperationRow
): MediaContentSaveOperationRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  actorSubject: row.actor_subject,
  targetType: row.target_type,
  targetId: row.target_id ?? undefined,
  status: row.status,
  errorCode: row.error_code ?? undefined,
  expiresAt: row.expires_at,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

export const mapReferenceRow = (row: MediaReferenceRow): MediaReferenceRecord => ({
  id: row.id,
  assetId: row.asset_id,
  targetType: row.target_type,
  targetId: row.target_id,
  role: row.role,
  sortOrder: row.sort_order ?? undefined,
  createdAt: row.created_at ?? undefined,
});

export const mapVariantRow = (row: MediaVariantRow): MediaVariantRecord => ({
  id: row.id,
  assetId: row.asset_id,
  variantKey: row.variant_key,
  presetKey: row.preset_key,
  format: row.format,
  width: row.width,
  height: row.height ?? undefined,
  storageKey: row.storage_key,
  generationStatus: row.generation_status,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

export const mapUploadSessionRow = (row: MediaUploadSessionRow): MediaUploadSessionRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  assetId: row.asset_id,
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  status: row.status,
  claimToken: row.claim_token ?? undefined,
  replacedClaimToken: row.replaced_claim_token ?? undefined,
  expiresAt: row.expires_at ?? undefined,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

export const mapStorageUsageRow = (row: MediaStorageUsageRow): MediaStorageUsageRecord => ({
  instanceId: row.instance_id,
  totalBytes: row.total_bytes,
  assetCount: row.asset_count,
  updatedAt: row.updated_at ?? undefined,
});

export const mapStorageQuotaRow = (row: MediaStorageQuotaRow): MediaStorageQuotaRecord => ({
  instanceId: row.instance_id,
  maxBytes: row.max_bytes,
  updatedAt: row.updated_at ?? undefined,
});
