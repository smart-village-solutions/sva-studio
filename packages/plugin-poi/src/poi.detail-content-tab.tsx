import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { PoiDetailFormValues } from './poi.detail-form.js';
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
  onAddManualMedia,
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
  create = false,
  categories,
}: Readonly<{
  onAddManualMedia: () => string;
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  mediaEditingDisabled?: boolean;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  onLoadAssetSnapshot?: (usage: ContentMediaUsage) => Promise<ContentMediaAssetSnapshot>;
  pt: (key: string) => string;
  create?: boolean;
  categories?: ReactNode;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();
  const content = useWatch({ control, name: 'content' });
  const media = (
    <fieldset disabled={mediaEditingDisabled} aria-busy={mediaEditingDisabled}>
      <PoiDetailMediaTab
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaUsages={mediaUsages}
        onAddManualMedia={onAddManualMedia}
        onChangeMediaUsages={onChangeMediaUsages}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        onOpenMediaPicker={onOpenMediaPicker}
        pt={pt}
      />
    </fieldset>
  );
  if (create)
    return (
      <div className="space-y-6">
        <div id="poi-create-location" tabIndex={-1}>
          <PoiDetailLocationTab pt={pt} />
        </div>
        <div id="poi-create-description" tabIndex={-1}>
          <PoiDetailDescriptionTab pt={pt} showName={false} />
        </div>
        <div id="poi-create-media" tabIndex={-1}>
          {media}
        </div>
        <div id="poi-create-categories" tabIndex={-1}>
          {categories}
        </div>
        <details>
          <summary id="poi-create-openingHours">
            {pt('create.sections.openingHours')} · {pt('create.optional')} ·{' '}
            {summary(content?.openingHours, pt)}
          </summary>
          <PoiDetailOpeningHoursTab pt={pt} />
        </details>
        <details>
          <summary id="poi-create-contact">
            {pt('create.sections.contact')} · {pt('create.optional')} ·{' '}
            {summary(content?.contact, pt)}
          </summary>
          <PoiDetailContactTab pt={pt} />
        </details>
        <details>
          <summary id="poi-create-links">
            {pt('create.sections.links')} · {pt('create.optional')} ·{' '}
            {summary(content?.webUrls, pt)}
          </summary>
          <PoiDetailLinksTab pt={pt} />
        </details>
        <details>
          <summary id="poi-create-prices">
            {pt('create.sections.prices')} · {pt('create.optional')} ·{' '}
            {summary(content?.prices, pt)}
          </summary>
          <PoiDetailPricesTab pt={pt} />
        </details>
        <details>
          <summary id="poi-create-operator">
            {pt('create.sections.operator')} · {pt('create.optional')} ·{' '}
            {summary(content?.operator, pt)}
          </summary>
          <PoiDetailOperatorTab pt={pt} />
        </details>
      </div>
    );
  return (
    <div className="space-y-6">
      <PoiDetailDescriptionTab pt={pt} />
      <PoiDetailLocationTab pt={pt} />
      <PoiDetailContactTab pt={pt} />
      <PoiDetailOpeningHoursTab pt={pt} />
      <PoiDetailLinksTab pt={pt} />
      <PoiDetailOperatorTab pt={pt} />
      <PoiDetailPricesTab pt={pt} />
      {media}
    </div>
  );
}

const hasText = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return value !== null && typeof value === 'object' && Object.values(value).some(hasText);
};
const summary = (value: unknown, pt: (key: string) => string) =>
  pt(hasText(value) ? 'create.filled' : 'create.empty');
