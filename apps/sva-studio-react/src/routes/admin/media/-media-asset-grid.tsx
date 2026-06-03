import type { IamMediaAsset } from '../../../lib/iam-api';

import { MediaAssetCard } from './-media-asset-card.js';
import { resolveMediaReferenceCount } from './-media-library-view-model.js';

type MediaAssetGridProps = Readonly<{
  assets: readonly IamMediaAsset[];
}>;

export const MediaAssetGrid = ({ assets }: MediaAssetGridProps) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {assets.map((asset) => (
      <MediaAssetCard
        key={asset.id}
        asset={asset}
        referenceCount={resolveMediaReferenceCount(asset)}
      />
    ))}
  </div>
);
