import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

import { PoiDetailAdvancedTab } from './poi.detail-advanced-tab.js';
import { PoiDetailSettingsImagesCard } from './poi.detail-settings-images-card.js';

export function PoiDetailSettingsTab({
  mediaAssets,
  pt,
}: Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  pt: (key: string) => string;
}>) {
  return (
    <div className="space-y-6">
      <PoiDetailSettingsImagesCard mediaAssets={mediaAssets} pt={pt} />
      <PoiDetailAdvancedTab pt={pt} />
    </div>
  );
}
