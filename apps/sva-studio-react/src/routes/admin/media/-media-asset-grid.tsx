import type { IamMediaAsset } from '../../../lib/iam-api';

import { MediaAssetCard } from './-media-asset-card.js';

type MediaAssetGridProps = Readonly<{
  assets: readonly IamMediaAsset[];
  usageByAssetId: Readonly<Record<string, number | null>>;
}>;

export const MediaAssetGrid = ({ assets, usageByAssetId }: MediaAssetGridProps) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {assets.map((asset) => (
        <MediaAssetCard
          key={asset.id}
          asset={asset}
          referenceCount={usageByAssetId[asset.id] ?? null}
        />
      ))}
  </div>
);
