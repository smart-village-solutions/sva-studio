import type { IamMediaAsset } from '../../../lib/iam-api';

export type MediaLibraryCardState = 'ready' | 'new' | 'blocked' | 'unused';

type MediaPriorityBuckets = Readonly<{
  blocked: number;
  newItems: number;
  unused: number;
}>;

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
};

const trimMetadataValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

export const resolveMediaReferenceCount = (asset: IamMediaAsset): number => {
  const candidates = [
    asset.technical.totalReferences,
    asset.technical.referenceCount,
    asset.technical.usageCount,
    typeof asset.technical.usage === 'object' && asset.technical.usage !== null
      ? (asset.technical.usage as Record<string, unknown>).totalReferences
      : null,
    typeof asset.technical.metrics === 'object' && asset.technical.metrics !== null
      ? (asset.technical.metrics as Record<string, unknown>).usageCount
      : null,
  ];

  for (const candidate of candidates) {
    const resolved = readNumber(candidate);
    if (resolved !== null) {
      return resolved;
    }
  }

  return 0;
};

export const resolveMediaCardState = (
  asset: IamMediaAsset,
  referenceCount: number
): MediaLibraryCardState => {
  if (
    asset.processingStatus === 'failed' ||
    asset.uploadStatus === 'failed' ||
    asset.uploadStatus === 'blocked'
  ) {
    return 'blocked';
  }

  if (referenceCount === 0) {
    return 'unused';
  }

  if (!trimMetadataValue(asset.metadata.title) || !trimMetadataValue(asset.metadata.altText)) {
    return 'new';
  }

  return 'ready';
};

export const countMediaPriorityBuckets = (
  assets: readonly IamMediaAsset[],
  usageByAssetId: Readonly<Record<string, number>>
): MediaPriorityBuckets =>
  assets.reduce<MediaPriorityBuckets>(
    (counts, asset) => {
      const referenceCount = usageByAssetId[asset.id] ?? 0;
      const state = resolveMediaCardState(asset, referenceCount);

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
