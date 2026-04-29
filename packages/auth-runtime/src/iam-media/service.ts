import type { MediaRepository } from '@sva/data-repositories';

export const createMediaService = (repository: MediaRepository) => ({
  listAssets: repository.listAssets,
  getAssetById: repository.getAssetById,
  upsertAsset: repository.upsertAsset,
  upsertVariant: repository.upsertVariant,
  listVariantsByAssetId: repository.listVariantsByAssetId,
  upsertUploadSession: repository.upsertUploadSession,
  getUploadSessionById: repository.getUploadSessionById,
  upsertStorageUsage: repository.upsertStorageUsage,
  getStorageUsage: repository.getStorageUsage,
  upsertStorageQuota: repository.upsertStorageQuota,
  getStorageQuota: repository.getStorageQuota,
  wouldExceedStorageQuota: repository.wouldExceedStorageQuota,
  replaceReferences: repository.replaceReferences,
  listReferencesByAssetId: repository.listReferencesByAssetId,
  getUsageImpact: repository.getUsageImpact,
});

export type MediaService = ReturnType<typeof createMediaService>;
