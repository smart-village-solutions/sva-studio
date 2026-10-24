import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { getHostMediaAsset, getHostMediaDelivery } from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  toContentMediaAssetSnapshot,
  useStudioSaveFeedback,
  StudioSection,
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

function createNewsSettingsPanel({
  loadedItem,
  canSendPushNotification,
  mode,
  pt,
  wasteOverview,
  wasteTargetingAvailability,
  loadWasteTargetingOverview,
  scheduledPublicationInput,
  invalidScheduledPublicationInput,
  methods,
  setScheduledPublicationInput,
  setInvalidScheduledPublicationInput,
}: NewsDetailPanelsOptions) {
  return (
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
  );
}

export const createNewsDetailPanels = (options: NewsDetailPanelsOptions) => {
  const {
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
    contentId,
  } = options;
  const basisProps: React.ComponentProps<typeof NewsDetailBasisTab> = {
    availableCategories: categoryOptions,
    principalControl,
    actingPrincipalType,
    onActingPrincipalTypeChange: setActingPrincipalType,
    categoryOptionsError,
    categoryOptionsLoading,
    mode,
    loadedItem,
    pt,
  };
  const contentProps: React.ComponentProps<typeof NewsDetailContentTab> = {
    mediaUsages,
    onAddManualMedia: addManualMedia,
    onChangeMediaUsages: (usages) =>
      updateNewsMediaUsages(usages, setMediaUsages, setRequiresReferenceSync),
    canSelectMedia,
    canUploadMedia,
    mediaEditingDisabled: saveFeedback.status === 'saving',
    onLoadAssetSnapshot: loadNewsAssetSnapshot,
    onOpenMediaPicker: (pickerMode) =>
      pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary(),
    pt,
  };
  const settingsPanel = createNewsSettingsPanel(options);
  if (mode === 'create') {
    return createNewsDetailTabDefinitions([
      {
        id: 'basis',
        label: pt('tabs.basis.label'),
        panel: (
          <StudioSection title={pt('create.heading')}>
            <p>{pt('create.intro')}</p>
            <NewsDetailBasisTab {...basisProps} section="principal" />
            <NewsDetailBasisTab {...basisProps} section="title" />
            <NewsDetailContentTab {...contentProps} section="text" createMode />
            <NewsDetailContentTab {...contentProps} section="media" createMode />
            <NewsDetailBasisTab {...basisProps} section="categories" />
            <NewsDetailContentTab {...contentProps} section="source" createMode />
            {settingsPanel}
          </StudioSection>
        ),
      },
    ]);
  }
  return createNewsDetailTabDefinitions([
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      hasChanges: dirtyTabs.basis,
      changeLabel: pt('tabs.changeLabel'),
      panel: <NewsDetailBasisTab {...basisProps} />,
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      hasChanges: dirtyTabs.content,
      changeLabel: pt('tabs.changeLabel'),
      panel: <NewsDetailContentTab {...contentProps} />,
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      hasChanges: dirtyTabs.settings,
      changeLabel: pt('tabs.changeLabel'),
      panel: settingsPanel,
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
