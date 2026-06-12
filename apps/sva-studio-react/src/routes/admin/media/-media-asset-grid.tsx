import { getMediaLibraryItemKey, type IamMediaAsset } from '../../../lib/iam-api';

import { MediaAssetCard } from './-media-asset-card.js';

type MediaAssetGridProps = Readonly<{
  assets: readonly IamMediaAsset[];
  usageByAssetId: Readonly<Record<string, number | null>>;
  usageStatusByAssetId: Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>;
}>;

export const MediaAssetGrid = ({
  assets,
  usageByAssetId,
  usageStatusByAssetId,
}: MediaAssetGridProps) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
    {assets.map((asset) => (
      <MediaAssetCard
        key={getMediaLibraryItemKey(asset)}
        asset={asset}
        referenceCount={usageByAssetId[getMediaLibraryItemKey(asset)] ?? null}
        usageStatus={usageStatusByAssetId[getMediaLibraryItemKey(asset)] ?? 'unavailable'}
      />
    ))}
  </div>
);
