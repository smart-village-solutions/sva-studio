import { PoiDetailContactTab } from './poi.detail-contact-tab.js';
import { PoiDetailDescriptionTab } from './poi.detail-description-tab.js';
import { PoiDetailLinksTab } from './poi.detail-links-tab.js';
import { PoiDetailLocationTab } from './poi.detail-location-tab.js';
import { PoiDetailOpeningHoursTab } from './poi.detail-opening-hours-tab.js';
import { PoiDetailOperatorTab } from './poi.detail-operator-tab.js';
import { PoiDetailPricesTab } from './poi.detail-prices-tab.js';

export function PoiDetailContentTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  return (
    <div className="space-y-6">
      <PoiDetailDescriptionTab pt={pt} />
      <PoiDetailLocationTab pt={pt} />
      <PoiDetailContactTab pt={pt} />
      <PoiDetailOpeningHoursTab pt={pt} />
      <PoiDetailLinksTab pt={pt} />
      <PoiDetailOperatorTab pt={pt} />
      <PoiDetailPricesTab pt={pt} />
    </div>
  );
}
