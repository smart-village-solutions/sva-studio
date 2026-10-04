export type MediaAssetLifecycleStatus = 'provisional' | 'active';

export type MediaAssetRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly storageKey: string;
  readonly mediaType: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly visibility: string;
  readonly uploadStatus: string;
  readonly processingStatus: string;
  readonly lifecycleStatus?: MediaAssetLifecycleStatus;
  readonly provisionalOperationId?: string;
  readonly provisionalOwnerSubject?: string;
  readonly provisionalDraftId?: string;
  readonly provisionalExpiresAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly technical: Readonly<Record<string, unknown>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type MediaContentSaveOperationStatus =
  | 'preparing'
  | 'uploading'
  | 'saving_content'
  | 'content_saved'
  | 'committed'
  | 'abandon_pending'
  | 'abandoned'
  | 'outcome_unknown'
  | 'reconciliation_required';

export type MediaContentSaveOperationRecord = Readonly<{
  id: string;
  instanceId: string;
  actorSubject: string;
  targetType: string;
  targetId?: string;
  status: MediaContentSaveOperationStatus;
  errorCode?: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export type MediaContentSaveOperationReference = Readonly<{
  id: string;
  assetId: string;
  role: string;
  sortOrder?: number;
}>;

export type MediaReferenceRecord = {
  readonly id: string;
  readonly assetId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly role: string;
  readonly sortOrder?: number;
  readonly createdAt?: string;
};

export type MediaVariantRecord = {
  readonly id: string;
  readonly assetId: string;
  readonly variantKey: string;
  readonly presetKey: string;
  readonly format: string;
  readonly width: number;
  readonly height?: number;
  readonly storageKey: string;
  readonly generationStatus: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type MediaUploadSessionRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly assetId: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly status: string;
  readonly claimToken?: string;
  readonly replacedClaimToken?: string;
  readonly expiresAt?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type * from './storage-model-types.js';
