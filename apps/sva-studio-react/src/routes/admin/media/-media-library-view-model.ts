import type { IamMediaAsset } from '../../../lib/iam-api';

export type MediaLibraryCardState = 'ready' | 'new' | 'blocked' | 'unused';

export type MediaPriorityBuckets = Readonly<{
  blocked: number;
  newItems: number;
  unused: number;
}>;

const trimMetadataValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

export const resolveMediaCardState = (
  asset: IamMediaAsset,
  referenceCount: number | null,
  usageStatus: 'loading' | 'ready' | 'unavailable' = 'ready'
): MediaLibraryCardState => {
  if (
    asset.processingStatus === 'failed' ||
    asset.uploadStatus === 'failed' ||
    asset.uploadStatus === 'blocked'
  ) {
    return 'blocked';
  }

  if (usageStatus === 'ready' && referenceCount === 0) {
    return 'unused';
  }

  if (!trimMetadataValue(asset.metadata.title) || !trimMetadataValue(asset.metadata.altText)) {
    return 'new';
  }

  return 'ready';
};

export const countMediaPriorityBuckets = (
  assets: readonly IamMediaAsset[],
  usageByAssetId: Readonly<Record<string, number | null>>,
  usageStatusByAssetId: Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>
): MediaPriorityBuckets =>
  assets.reduce<MediaPriorityBuckets>(
    (counts, asset) => {
      const referenceCount = usageByAssetId[asset.id] ?? null;
      const usageStatus = usageStatusByAssetId[asset.id] ?? 'unavailable';
      const state = resolveMediaCardState(asset, referenceCount, usageStatus);

      return {
        blocked: counts.blocked + (state === 'blocked' ? 1 : 0),
        newItems: counts.newItems + (state === 'new' ? 1 : 0),
        unused: counts.unused + (state === 'unused' ? 1 : 0),
      };
    },
    {
      blocked: 0,
      newItems: 0,
      unused: 0,
    }
  );
