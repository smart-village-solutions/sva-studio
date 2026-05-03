import type { MediaRepository } from '@sva/data-repositories';

export const createMediaService = (repository: MediaRepository) => ({
  listAssets: repository.listAssets,
  countAssets: repository.countAssets,
  getAssetById: repository.getAssetById,
  deleteAsset: repository.deleteAsset,
  upsertAsset: repository.upsertAsset,
  upsertVariant: repository.upsertVariant,
  listVariantsByAssetId: repository.listVariantsByAssetId,
  upsertUploadSession: repository.upsertUploadSession,
  getUploadSessionById: repository.getUploadSessionById,
  upsertStorageUsage: repository.upsertStorageUsage,
  applyStorageUsageDelta: repository.applyStorageUsageDelta,
  getStorageUsage: repository.getStorageUsage,
  upsertStorageQuota: repository.upsertStorageQuota,
  getStorageQuota: repository.getStorageQuota,
  wouldExceedStorageQuota: repository.wouldExceedStorageQuota,
  replaceReferences: repository.replaceReferences,
  listReferencesByAssetId: repository.listReferencesByAssetId,
  listReferencesByTarget: repository.listReferencesByTarget,
  getUsageImpact: repository.getUsageImpact,
});

export type MediaService = ReturnType<typeof createMediaService>;
