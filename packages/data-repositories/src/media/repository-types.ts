import type {
  MediaAssetRecord,
  MediaContentSaveOperationRecord,
  MediaContentSaveOperationReference,
  MediaReferenceRecord,
  MediaVariantRecord,
  MediaUploadSessionRecord,
  MediaStorageUsageRecord,
  MediaStorageUsageDelta,
  MediaStorageUsageClaim,
  MediaStorageQuotaRecord,
  MediaStorageQuotaCheck,
  MediaUsageImpact,
  MediaAssetListFilter,
} from './model-types.js';
export type MediaRepository = {
  upsertAsset(input: MediaAssetRecord): Promise<void>;
  getAssetById(instanceId: string, assetId: string): Promise<MediaAssetRecord | null>;
  getAssetByStorageKey(instanceId: string, storageKey: string): Promise<MediaAssetRecord | null>;
  getProvisionalAssetByDraft(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly draftId: string;
    readonly actorSubject: string;
  }): Promise<MediaAssetRecord | null>;
  listAssetsByOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<readonly MediaAssetRecord[]>;
  listAssets(filter: MediaAssetListFilter): Promise<readonly MediaAssetRecord[]>;
  countAssets(filter: Omit<MediaAssetListFilter, 'limit' | 'offset'>): Promise<number>;
  deleteAsset(instanceId: string, assetId: string): Promise<void>;
  deleteVariantsByAssetId(instanceId: string, assetId: string): Promise<void>;
  upsertVariant(instanceId: string, input: MediaVariantRecord): Promise<void>;
  listVariantsByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<readonly MediaVariantRecord[]>;
  upsertUploadSession(input: MediaUploadSessionRecord): Promise<void>;
  refreshPendingUploadSession(input: {
    readonly instanceId: string;
    readonly sessionId: string;
    readonly storageKey: string;
    readonly expiresAt?: string;
  }): Promise<boolean>;
  getUploadSessionById(
    instanceId: string,
    sessionId: string
  ): Promise<MediaUploadSessionRecord | null>;
  getUploadSessionByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<MediaUploadSessionRecord | null>;
  claimUploadSession(
    instanceId: string,
    sessionId: string
  ): Promise<MediaUploadSessionRecord | null>;
  lockUploadSessionClaim(input: {
    readonly instanceId: string;
    readonly sessionId: string;
    readonly claimToken: string;
  }): Promise<boolean>;
  upsertStorageUsage(input: MediaStorageUsageRecord): Promise<void>;
  applyStorageUsageDelta(input: MediaStorageUsageDelta): Promise<void>;
  tryApplyStorageUsageWithinQuota(input: MediaStorageUsageClaim): Promise<boolean>;
  getStorageUsage(instanceId: string): Promise<MediaStorageUsageRecord | null>;
  upsertStorageQuota(input: MediaStorageQuotaRecord): Promise<void>;
  getStorageQuota(instanceId: string): Promise<MediaStorageQuotaRecord | null>;
  wouldExceedStorageQuota(
    instanceId: string,
    additionalBytes: number
  ): Promise<MediaStorageQuotaCheck>;
  replaceReferences(input: {
    readonly instanceId: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly references: readonly MediaReferenceRecord[];
  }): Promise<void>;
  listReferencesByAssetId(
    instanceId: string,
    assetId: string
  ): Promise<readonly MediaReferenceRecord[]>;
  listReferencesByTarget(
    instanceId: string,
    targetType: string,
    targetId: string
  ): Promise<readonly MediaReferenceRecord[]>;
  getUsageImpact(instanceId: string, assetId: string): Promise<MediaUsageImpact>;
  createContentSaveOperation(
    input: MediaContentSaveOperationRecord
  ): Promise<MediaContentSaveOperationRecord>;
  getContentSaveOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<MediaContentSaveOperationRecord | null>;
  lockOpenContentSaveOperationForUpload(input: {
    readonly instanceId: string;
    readonly operationId: string;
  }): Promise<boolean>;
  replaceContentSaveOperationReferences(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly references: readonly MediaContentSaveOperationReference[];
  }): Promise<boolean>;
  markContentSaveOperationContentSaved(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly targetId: string;
  }): Promise<boolean>;
  markContentSaveOperationSavingContent(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  markContentSaveOperationOutcomeUnknown(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly errorCode?: string;
  }): Promise<boolean>;
  commitContentSaveOperation(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  markContentSaveOperationAbandonPending(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
    readonly errorCode?: string;
  }): Promise<boolean>;
  finalizeContentSaveOperationAbandoned(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
  claimContentSaveOperationRecovery(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly leaseOwner: string;
    readonly leaseExpiresAt: string;
    readonly now: string;
  }): Promise<MediaContentSaveOperationRecord | null>;
  finalizeContentSaveOperationCleanup(input: {
    readonly instanceId: string;
    readonly operationId: string;
    readonly actorSubject: string;
  }): Promise<boolean>;
};
