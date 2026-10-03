import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { getHostMediaAsset, getHostMediaDelivery } from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  toContentMediaAssetSnapshot,
  useStudioSaveFeedback,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { NewsDetailBasisTab } from './news.detail-basis-tab.js';
import { NewsDetailContentTab } from './news.detail-content-tab.js';
import { NewsDetailHistoryTab } from './news.detail-history-tab.js';
import { NewsDetailSettingsTab } from './news.detail-settings-tab.js';
import { deriveDirtyNewsDetailTabs } from './news.detail-form.js';
import { parseDatetimeLocalInput, type PluginTranslator } from './news.detail-page.helpers.js';
import { useNewsDetailMedia } from './news.detail-page-media.js';
import { createNewsDetailTabDefinitions } from './news.detail-tabs.js';
import type { NewsWasteMasterDataOverview } from './news.waste-targeting.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
import type {
  NewsCategoryOption,
  NewsContentItem,
  NewsDetailFormValues,
  NewsPrincipalControl,
} from './news.types.js';

const updateNewsMediaUsages = (
  usages: readonly ContentMediaUsage[],
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>,
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setMediaUsages(usages);
  setRequiresReferenceSync((current) => current || usages.some((usage) => Boolean(usage.assetId)));
};

const loadNewsAssetSnapshot = async (usage: ContentMediaUsage) => {
  if (!usage.assetId) throw new Error('asset_unavailable');
  const [detail, delivery] = await Promise.all([
    getHostMediaAsset({
      fetch: globalThis.fetch.bind(globalThis),
      assetId: usage.assetId,
    }),
    getHostMediaDelivery({
      fetch: globalThis.fetch.bind(globalThis),
      assetId: usage.assetId,
    }),
  ]);
  if (delivery.isPublicUrl !== true || !isPersistableContentMediaUrl(delivery.deliveryUrl))
    throw new Error('asset_unavailable');
  return toContentMediaAssetSnapshot({
    persistentUrl: delivery.deliveryUrl,
    altText: detail.metadata.altText ?? '',
    caption: detail.metadata.description ?? '',
    credit: detail.metadata.copyright ?? '',
    license: detail.metadata.license ?? '',
  });
};

type NewsDetailPanelsOptions = Readonly<{
  pt: PluginTranslator;
  dirtyTabs: ReturnType<typeof deriveDirtyNewsDetailTabs>;
  categoryOptions: readonly NewsCategoryOption[];
  principalControl?: NewsPrincipalControl;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  mode: 'create' | 'edit';
  loadedItem: NewsContentItem | null;
  mediaUsages: readonly ContentMediaUsage[];
  addManualMedia: () => string;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  mediaPicker: ReturnType<typeof useNewsDetailMedia>['mediaPicker'];
  canSendPushNotification: boolean;
  wasteOverview: NewsWasteMasterDataOverview | null;
  wasteTargetingAvailability: WasteTargetingAvailability;
  loadWasteTargetingOverview: () => Promise<boolean>;
  scheduledPublicationInput: string;
  invalidScheduledPublicationInput: boolean;
  methods: UseFormReturn<NewsDetailFormValues>;
  setScheduledPublicationInput: React.Dispatch<React.SetStateAction<string>>;
  setInvalidScheduledPublicationInput: React.Dispatch<React.SetStateAction<boolean>>;
  contentId?: string;
}>;

export const createNewsDetailPanels = ({
  pt,
  dirtyTabs,
  categoryOptions,
  principalControl,
  actingPrincipalType,
  setActingPrincipalType,
  categoryOptionsError,
  categoryOptionsLoading,
  mode,
  loadedItem,
  mediaUsages,
  addManualMedia,
  setMediaUsages,
  setRequiresReferenceSync,
  canSelectMedia,
  canUploadMedia,
  saveFeedback,
  mediaPicker,
  canSendPushNotification,
  wasteOverview,
  wasteTargetingAvailability,
  loadWasteTargetingOverview,
  scheduledPublicationInput,
  invalidScheduledPublicationInput,
  methods,
  setScheduledPublicationInput,
  setInvalidScheduledPublicationInput,
  contentId,
}: NewsDetailPanelsOptions) => {
  return createNewsDetailTabDefinitions([
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      hasChanges: dirtyTabs.basis,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailBasisTab
          availableCategories={categoryOptions}
          principalControl={principalControl}
          actingPrincipalType={actingPrincipalType}
          onActingPrincipalTypeChange={setActingPrincipalType}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          mode={mode}
          loadedItem={loadedItem}
          pt={pt}
        />
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      hasChanges: dirtyTabs.content,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailContentTab
          mediaUsages={mediaUsages}
          onAddManualMedia={addManualMedia}
          onChangeMediaUsages={(usages) =>
            updateNewsMediaUsages(usages, setMediaUsages, setRequiresReferenceSync)
          }
          canSelectMedia={canSelectMedia}
          canUploadMedia={canUploadMedia}
          mediaEditingDisabled={saveFeedback.status === 'saving'}
          onLoadAssetSnapshot={loadNewsAssetSnapshot}
          onOpenMediaPicker={(pickerMode) =>
            pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
          }
          pt={pt}
        />
      ),
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      hasChanges: dirtyTabs.settings,
      changeLabel: pt('tabs.changeLabel'),
      panel: (
        <NewsDetailSettingsTab
          loadedItem={loadedItem}
          canSendPushNotification={canSendPushNotification}
          mode={mode}
          pt={pt}
          wasteOverview={wasteOverview}
          wasteTargetingAvailability={wasteTargetingAvailability}
          onLoadWasteOverview={loadWasteTargetingOverview}
          scheduledPublicationField={{
            value: scheduledPublicationInput,
            isInvalid: invalidScheduledPublicationInput,
            onChange: (nextValue) => {
              const { isInvalid, normalizedValue } = parseDatetimeLocalInput(
                nextValue,
                methods.getValues('scheduledPublicationAt')
              );
              setScheduledPublicationInput(nextValue);
              setInvalidScheduledPublicationInput(isInvalid);
              return normalizedValue;
            },
          }}
        />
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      panel: <NewsDetailHistoryTab contentId={contentId} pt={pt} />,
    },
  ]);
};
