import type { MediaAssetLifecycleStatus, MediaContentSaveOperationStatus } from './model-types.js';
export type MediaAssetRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly storage_key: string;
  readonly media_type: string;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly visibility: string;
  readonly upload_status: string;
  readonly processing_status: string;
  readonly lifecycle_status: MediaAssetLifecycleStatus;
  readonly provisional_operation_id: string | null;
  readonly provisional_owner_subject: string | null;
  readonly provisional_draft_id: string | null;
  readonly provisional_expires_at: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly technical: Record<string, unknown> | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export type MediaContentSaveOperationRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly actor_subject: string;
  readonly target_type: string;
  readonly target_id: string | null;
  readonly status: MediaContentSaveOperationStatus;
  readonly error_code: string | null;
  readonly expires_at: string;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export type MediaReferenceRow = {
  readonly id: string;
  readonly asset_id: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly role: string;
  readonly sort_order: number | null;
  readonly created_at: string | null;
};

export type MediaVariantRow = {
  readonly id: string;
  readonly asset_id: string;
  readonly variant_key: string;
  readonly preset_key: string;
  readonly format: string;
  readonly width: number;
  readonly height: number | null;
  readonly storage_key: string;
  readonly generation_status: string;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export type MediaUploadSessionRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly asset_id: string;
  readonly storage_key: string;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly status: string;
  readonly claim_token: string | null;
  readonly replaced_claim_token?: string | null;
  readonly expires_at: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export type MediaStorageUsageRow = {
  readonly instance_id: string;
  readonly total_bytes: number;
  readonly asset_count: number;
  readonly updated_at: string | null;
};

export type MediaStorageQuotaRow = {
  readonly instance_id: string;
  readonly max_bytes: number;
  readonly updated_at: string | null;
};
