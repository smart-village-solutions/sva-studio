import { PoiDetailContactTab } from './poi.detail-contact-tab.js';
import { PoiDetailDescriptionTab } from './poi.detail-description-tab.js';
import { PoiDetailLinksTab } from './poi.detail-links-tab.js';
import { PoiDetailLocationTab } from './poi.detail-location-tab.js';
import { PoiDetailMediaTab } from './poi.detail-media-tab.js';
import { PoiDetailOpeningHoursTab } from './poi.detail-opening-hours-tab.js';
import { PoiDetailOperatorTab } from './poi.detail-operator-tab.js';
import { PoiDetailPricesTab } from './poi.detail-prices-tab.js';
import type { ContentMediaAssetSnapshot, ContentMediaUsage } from '@sva/studio-ui-react';

export function PoiDetailContentTab({
  onOpenMediaPicker,
  canSelectMedia = false,
  canUploadMedia = false,
  mediaEditingDisabled = false,
  mediaUsages,
  onChangeMediaUsages = () => undefined,
  onLoadAssetSnapshot = async () => {
    throw new Error('asset_refresh_unavailable');
  },
  pt,
}: Readonly<{
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  onLoadAssetSnapshot?: (usage: ContentMediaUsage) => Promise<ContentMediaAssetSnapshot>;
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
      <fieldset disabled={mediaEditingDisabled} aria-busy={mediaEditingDisabled}>
        <PoiDetailMediaTab
          canSelectMedia={canSelectMedia}
          canUploadMedia={canUploadMedia}
          mediaUsages={mediaUsages}
          onChangeMediaUsages={onChangeMediaUsages}
          onLoadAssetSnapshot={onLoadAssetSnapshot}
          onOpenMediaPicker={onOpenMediaPicker}
          pt={pt}
        />
      </fieldset>
    </div>
  );
}
