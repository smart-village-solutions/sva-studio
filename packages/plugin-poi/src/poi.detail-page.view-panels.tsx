import React from 'react';
import { getHostMediaAsset, getHostMediaDelivery, usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentOwnershipPanelSlot,
  isPersistableContentMediaUrl,
  type ContentMediaAssetSnapshot,
} from '@sva/studio-ui-react';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import { PoiDetailContentTab } from './poi.detail-content-tab.js';
import { PoiDetailHistoryTab } from './poi.detail-history-tab.js';
import { PoiDetailSettingsTab } from './poi.detail-settings-tab.js';
import type { PoiDetailTabId } from './poi.detail-tabs.js';
import type { PoiCategoryOption, PoiContentItem } from './poi.types.js';
import { usePoiDetailMedia } from './poi.detail-page.media.js';

const loadPoiMediaAssetSnapshot = async (
  usage: import('@sva/studio-ui-react').ContentMediaUsage,
  instanceId?: string
): Promise<ContentMediaAssetSnapshot> => {
  if (!usage.assetId) throw new Error('missing_asset_id');
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset({
      fetch: globalThis.fetch.bind(globalThis),
      assetId: usage.assetId,
      instanceId,
    }),
    getHostMediaDelivery({
      fetch: globalThis.fetch.bind(globalThis),
      assetId: usage.assetId,
      instanceId,
    }),
  ]);
  if (delivery.isPublicUrl !== true || !isPersistableContentMediaUrl(delivery.deliveryUrl))
    throw new Error('asset_unavailable');
  return {
    persistentUrl: delivery.deliveryUrl,
    altText: asset.metadata.altText ?? asset.metadata.description ?? '',
    caption: asset.metadata.description ?? '',
    credit: asset.metadata.copyright ?? '',
    license: asset.metadata.license ?? '',
  };
};

type PanelInput = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
  categoryOptions: readonly PoiCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  loadedItem: PoiContentItem | null;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  saveStatus: string;
  media: ReturnType<typeof usePoiDetailMedia>;
  pt: ReturnType<typeof usePluginTranslation>;
}>;

export const createPoiTabPanels = ({
  mode,
  contentId,
  instanceId,
  categoryOptions,
  categoryOptionsError,
  categoryOptionsLoading,
  loadedItem,
  canSelectMedia,
  canUploadMedia,
  saveStatus,
  media,
  pt,
}: PanelInput): Record<PoiDetailTabId, React.JSX.Element> => {
  const {
    mediaUsages,
    setMediaUsages,
    setRequiresReferenceSync,
    mediaReferencesReady,
    addManualMedia,
    mediaPicker,
  } = media;
  const tabPanels = {
    basis: (
      <div className="space-y-4">
        {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
        <PoiDetailBasisTab
          availableCategories={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          loadedItem={loadedItem}
          mode={mode}
          pt={pt}
        />
      </div>
    ),
    content: (
      <PoiDetailContentTab
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaEditingDisabled={!mediaReferencesReady || saveStatus === 'saving'}
        mediaUsages={mediaUsages}
        onAddManualMedia={addManualMedia}
        onChangeMediaUsages={(usages) => {
          setMediaUsages(usages);
          setRequiresReferenceSync(
            (current) => current || usages.some((usage) => Boolean(usage.assetId))
          );
        }}
        onLoadAssetSnapshot={(usage) => loadPoiMediaAssetSnapshot(usage, instanceId)}
        onOpenMediaPicker={(pickerMode) =>
          pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
        }
        pt={pt}
      />
    ),
    settings: <PoiDetailSettingsTab pt={pt} />,
    history: <PoiDetailHistoryTab contentId={contentId} pt={pt} />,
  } as const satisfies Record<PoiDetailTabId, React.JSX.Element>;
  return tabPanels;
};
