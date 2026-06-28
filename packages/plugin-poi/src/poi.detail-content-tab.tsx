import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

import { PoiDetailContactTab } from './poi.detail-contact-tab.js';
import { PoiDetailDescriptionTab } from './poi.detail-description-tab.js';
import { PoiDetailLinksTab } from './poi.detail-links-tab.js';
import { PoiDetailLocationTab } from './poi.detail-location-tab.js';
import { PoiDetailMediaTab } from './poi.detail-media-tab.js';
import { PoiDetailOpeningHoursTab } from './poi.detail-opening-hours-tab.js';
import { PoiDetailOperatorTab } from './poi.detail-operator-tab.js';
import { PoiDetailPricesTab } from './poi.detail-prices-tab.js';

const defaultUploadFile = async (): Promise<HostMediaAssetListItem> => {
  throw new Error('poi_media_upload_unavailable');
};

export function PoiDetailContentTab({
  mediaAssets = [],
  onUploadFile = defaultUploadFile,
  pt,
}: Readonly<{
  mediaAssets?: readonly HostMediaAssetListItem[];
  onUploadFile?: (file: File) => Promise<HostMediaAssetListItem>;
  pt: (key: string) => string;
}>) {
  return (
    <div className="space-y-6">
      <PoiDetailDescriptionTab pt={pt} />
      <PoiDetailLocationTab pt={pt} />
      <PoiDetailContactTab pt={pt} />
      <PoiDetailOpeningHoursTab pt={pt} />
      <PoiDetailLinksTab pt={pt} />
      <PoiDetailOperatorTab pt={pt} />
      <PoiDetailPricesTab pt={pt} />
      <PoiDetailMediaTab mediaAssets={mediaAssets} onUploadFile={onUploadFile} pt={pt} />
    </div>
  );
}
