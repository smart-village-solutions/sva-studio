import type { IamMediaAsset } from '../../../lib/iam-api';

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
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {assets.map((asset) => (
      <MediaAssetCard
        key={asset.id}
        asset={asset}
        referenceCount={usageByAssetId[asset.id] ?? null}
        usageStatus={usageStatusByAssetId[asset.id] ?? 'unavailable'}
      />
    ))}
  </div>
);
