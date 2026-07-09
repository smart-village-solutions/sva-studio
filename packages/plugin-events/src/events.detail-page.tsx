import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  getHostMediaAsset,
  listHostMediaAssets,
  updateHostMediaAsset,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  Button,
  Select,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';

import {
  createEvent,
  deleteEvent,
  EventsApiError,
  getEvent,
  listEventCategories,
  listPoiForEventSelection,
  updateEvent,
} from './events.api.js';
import { fromDateOnlyInputValue, toDateOnlyInputValue } from './events.date-only.js';
import {
  createDefaultMediaContent,
  createDefaultEventsDetailFormValues,
  mapEventItemToDetailFormValues,
  mapEventsDetailFormValuesToInput,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailBasisTab } from './events.detail-basis-tab.js';
import { EventsDetailContentTab } from './events.detail-content-tab.js';
import { EventsDetailHistoryTab } from './events.detail-history-tab.js';
import {
  isSupportedUploadFile,
  mediaContentFromAsset,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
} from './events.detail-media.helpers.js';
import { EventsDetailSettingsTab } from './events.detail-settings-tab.js';
import { createEventsDetailTabDefinitions, type EventsDetailTabId } from './events.detail-tabs.js';
import type { EventCategoryOption, EventContentItem } from './events.types.js';
import type { PoiSelectItem } from './events.types.js';
import { hasInvalidGeoLocation, validateEventForm } from './events.validation.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

type EventsMediaPickerAsset = StudioMediaPickerAssetDetail;

type EventsTabIconProps = Readonly<{ className?: string }>;

const EventsTabBasisIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 4.75h7.5L19 9.25v9A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25v-11.5A1.75 1.75 0 0 1 6.75 5Z" />
    <path d="M14 4.75v4.5h4.5" />
    <path d="M8.5 12h7" />
    <path d="M8.5 15.5h7" />
  </svg>
);

const EventsTabContentIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4.5" y="5" width="15" height="14" rx="2" />
    <path d="m8 14 2.5-2.5 2 2 2.5-3 3 4.5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);

const EventsTabSettingsIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7h10" />
    <path d="M4 17h16" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
);

const EventsTabHistoryIcon = ({ className }: EventsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 5.5v3.7h3.7" />
    <path d="M12 8.5v4l2.5 1.5" />
  </svg>
);

const eventsTabIconMap = {
  basis: EventsTabBasisIcon,
  content: EventsTabContentIcon,
  settings: EventsTabSettingsIcon,
  history: EventsTabHistoryIcon,
} as const satisfies Record<EventsDetailTabId, (props: EventsTabIconProps) => React.JSX.Element>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, error: unknown, fallbackKey: string) =>
  error instanceof EventsApiError ? error.message : pt(fallbackKey);

const parseDateOnlyInput = (value: string) => {
  if (value.trim().length === 0) {
    return { isInvalid: false, normalizedValue: '' };
  }

  const normalizedValue = fromDateOnlyInputValue(value);
  return {
    isInvalid: normalizedValue.length === 0,
    normalizedValue,
  };
};

const readDetailFileName = (asset: Pick<HostMediaAssetDetail, 'id' | 'storageKey'>): string => {
  const storageKeyParts = asset.storageKey.split('/');
  const fileName = storageKeyParts[storageKeyParts.length - 1]?.trim();
  return fileName && fileName.length > 0 ? fileName : asset.id;
};

const toEventsMediaPickerSummary = (asset: HostMediaAssetListItem): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toEventsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem
): EventsMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : readDetailFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl ?? summary?.previewUrl ?? null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

const createEventsMediaPickerLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): StudioMediaPickerOverlayLabels => ({
  title: pt('messages.mediaPickerTitle'),
  description: pt('messages.mediaPickerDescription'),
  modes: {
    library: pt('actions.addImage'),
    upload: pt('actions.uploadMedia'),
    review: pt('messages.mediaPickerReviewMode'),
  },
  library: {
    searchLabel: pt('fields.imageSearch'),
    empty: pt('messages.imagePickerEmpty'),
    select: pt('actions.selectImage'),
  },
  upload: {
    regionLabel: pt('messages.mediaPickerUploadRegionLabel'),
    title: pt('messages.mediaPickerUploadTitle'),
    description: pt('messages.mediaPickerUploadDescription'),
    browseAction: pt('messages.mediaPickerSelectFile'),
    supportLabel: pt('messages.mediaPickerUploadSupportLabel'),
  },
  review: {
    title: pt('messages.mediaPickerReviewTitle'),
    description: pt('messages.mediaPickerReviewDescription'),
  },
  fields: {
    title: pt('fields.title'),
    altText: pt('messages.mediaPickerAltText'),
    description: pt('fields.description'),
    copyright: pt('fields.mediaCopyright'),
    license: pt('messages.mediaPickerLicense'),
  },
  actions: {
    cancel: pt('actions.back'),
    backToLibrary: pt('messages.mediaPickerBackToLibrary'),
    backToUpload: pt('messages.mediaPickerBackToUpload'),
    openMediaManagement: pt('messages.mediaPickerOpenMediaManagement'),
    useMedia: pt('messages.mediaPickerUseMedia'),
  },
});

const resolveEventsMediaPickerFeedback = (
  pt: ReturnType<typeof usePluginTranslation>,
  errorCode: StudioMediaPickerErrorCode | null,
  uploadPhase: Parameters<typeof uploadPhaseMessageKey>[0]
) => {
  if (errorCode === 'unsupported_upload_type') {
    return { message: pt('messages.mediaUploadUnsupportedType'), tone: 'error' as const };
  }
  if (errorCode === 'upload_failed') {
    return { message: pt('messages.mediaUploadError'), tone: 'error' as const };
  }
  if (errorCode === 'asset_load_failed') {
    return { message: pt('messages.mediaPickerAssetLoadError'), tone: 'error' as const };
  }
  if (errorCode === 'asset_unavailable') {
    return { message: pt('messages.mediaUploadUnavailableUrl'), tone: 'error' as const };
  }
  if (errorCode === 'metadata_save_failed') {
    return { message: pt('messages.mediaPickerMetadataSaveError'), tone: 'error' as const };
  }

  const phaseKey = uploadPhaseMessageKey(uploadPhase);
  if (!phaseKey) {
    return { message: null, tone: 'default' as const };
  }

  return {
    message: pt(phaseKey),
    tone: uploadPhase === 'success' ? ('success' as const) : ('default' as const),
  };
};

export function EventsDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const formId = React.useId();
  const methods = useForm<EventsDetailFormValues>({
    defaultValues: createDefaultEventsDetailFormValues(),
  });
  const { reset } = methods;
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<EventContentItem | null>(null);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [dateStartInput, setDateStartInput] = React.useState('');
  const [dateEndInput, setDateEndInput] = React.useState('');
  const [invalidDateInputs, setInvalidDateInputs] = React.useState({ dateStart: false, dateEnd: false });
  const [activeTab, setActiveTab] = React.useState<EventsDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly EventsDetailTabId[]>(['basis']);
  const [categoryOptions, setCategoryOptions] = React.useState<readonly EventCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const [poiOptions, setPoiOptions] = React.useState<readonly PoiSelectItem[]>([]);
  const [poiOptionsLoading, setPoiOptionsLoading] = React.useState(true);
  const [poiOptionsError, setPoiOptionsError] = React.useState<string | null>(null);
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const mediaPickerLabels = React.useMemo(() => createEventsMediaPickerLabels(pt), [pt]);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), visibility: 'public' });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, []);

  const isAssetSelectable = React.useCallback((asset: EventsMediaPickerAsset) => {
    const nextMedia = mediaContentFromAsset({
      id: asset.id,
      fileName: asset.fileName,
      metadata: asset.metadata,
      visibility: asset.visibility,
      mimeType: asset.mimeType,
      previewUrl: asset.previewUrl,
    });
    if (!nextMedia) {
      return false;
    }

    const existingUrls = new Set(
      (methods.getValues('content.mediaContents') ?? [])
        .map((entry) => entry.sourceUrl?.url?.trim() ?? '')
        .filter((value) => value.length > 0)
    );
    const nextUrl = nextMedia.sourceUrl?.url?.trim() ?? '';
    return existingUrls.has(nextUrl) === false;
  }, [methods]);

  const mediaPicker = useStudioMediaPickerOverlay<EventsMediaPickerAsset>({
    onAccept: (asset) => {
      const nextMedia = mediaContentFromAsset({
        id: asset.id,
        fileName: asset.fileName,
        metadata: asset.metadata,
        visibility: asset.visibility,
        mimeType: asset.mimeType,
        previewUrl: asset.previewUrl,
      });
      if (!nextMedia) {
        return;
      }

      const currentMedia = methods.getValues('content.mediaContents') ?? [];
      methods.setValue(
        'content.mediaContents',
        [
          ...currentMedia,
          {
            ...createDefaultMediaContent(),
            captionText: nextMedia.captionText ?? '',
            copyright: nextMedia.copyright ?? '',
            contentType: nextMedia.contentType ?? '',
            sourceUrl: {
              url: nextMedia.sourceUrl?.url ?? '',
              description: nextMedia.sourceUrl?.description ?? '',
            },
          },
        ],
        { shouldDirty: true }
      );
      void refreshMediaAssets();
    },
    canAcceptAsset: isAssetSelectable,
    isSupportedUploadFile,
    uploadAsset: async (file) => {
      const uploaded = await uploadHostMediaFile({
        fetch: globalThis.fetch.bind(globalThis),
        file,
        mediaType: 'image',
        visibility: 'public',
      });
      await refreshMediaAssets();
      return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
    },
    loadAsset: async (assetId) => {
      const detail = await getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId });
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      return toEventsMediaPickerDetail(detail, summary);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const detail = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        visibility: 'public',
        metadata,
      });
      await refreshMediaAssets();
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      return toEventsMediaPickerDetail(detail, summary);
    },
  });
  const mediaPickerFeedback = React.useMemo(
    () => resolveEventsMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  React.useEffect(() => {
    void listPoiForEventSelection()
      .then((pois) => {
        setPoiOptions(pois);
        setPoiOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setPoiOptions([]);
        setPoiOptionsError(errorMessage(pt, loadError, 'messages.poiOptionsLoadError'));
      })
      .finally(() => {
        setPoiOptionsLoading(false);
      });
    void listEventCategories()
      .then((categories) => {
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setCategoryOptions([]);
        setCategoryOptionsError(errorMessage(pt, loadError, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => {
        setCategoryOptionsLoading(false);
      });
    void refreshMediaAssets();
  }, [pt, refreshMediaAssets]);

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }

    let active = true;
    void getEvent(contentId)
      .then((item) => {
        if (!active) {
          return;
        }
        const nextValues = mapEventItemToDetailFormValues(item);
        reset(nextValues);
        setLoadedItem(item);
        setDateStartInput(toDateOnlyInputValue(nextValues.content.dates?.[0]?.dateStart));
        setDateEndInput(toDateOnlyInputValue(nextValues.content.dates?.[0]?.dateEnd));
        setInvalidDateInputs({ dateStart: false, dateEnd: false });
        setLoading(false);
      })
      .catch((loadError) => {
        if (active) {
          setStatus({ kind: 'error', text: errorMessage(pt, loadError, 'messages.missingContent') });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode, reset]);

  const tabs = createEventsDetailTabDefinitions(pt);

  const warmTab = React.useCallback((tabId: EventsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (tabId: EventsDetailTabId) => {
      warmTab(tabId);
      setActiveTab(tabId);
    },
    [warmTab]
  );

  const updateDateField = React.useCallback(
    (field: 'dateStart' | 'dateEnd', nextValue: string) => {
      const currentDate = methods.getValues('content.dates.0') ?? {};
      const { isInvalid, normalizedValue } = parseDateOnlyInput(nextValue);
      methods.setValue(
        'content.dates',
        [{ ...currentDate, [field]: normalizedValue }],
        { shouldDirty: true }
      );
      setInvalidDateInputs((current) => ({ ...current, [field]: isInvalid }));
      if (field === 'dateStart') {
        setDateStartInput(nextValue);
      } else {
        setDateEndInput(nextValue);
      }
    },
    [methods]
  );

  const submit = methods.handleSubmit(async (values) => {
    setStatus(null);
    methods.clearErrors();
    const payload = mapEventsDetailFormValuesToInput(values);
    const validationErrors = [
      ...validateEventForm(payload),
      ...(invalidDateInputs.dateStart || invalidDateInputs.dateEnd ? ['dates'] : []),
    ];

    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      if (validationErrors.includes('dates')) {
        methods.setFocus('content.dates.0.dateStart');
        setActiveTab('content');
      } else if (validationErrors.includes('geoLocation')) {
        if ((payload.addresses ?? []).some((address) => hasInvalidGeoLocation(address.geoLocation))) {
          methods.setError('content.addresses.0.geoLocation.latitude', { type: 'manual', message: 'geoLocation' });
          methods.setError('content.addresses.0.geoLocation.longitude', { type: 'manual', message: 'geoLocation' });
          methods.setFocus('content.addresses.0.geoLocation.latitude');
        }
        if (hasInvalidGeoLocation(payload.organizer?.address?.geoLocation)) {
          methods.setError('content.organizer.address.geoLocation.latitude', { type: 'manual', message: 'geoLocation' });
          methods.setError('content.organizer.address.geoLocation.longitude', { type: 'manual', message: 'geoLocation' });
          methods.setFocus('content.organizer.address.geoLocation.latitude');
        }
        setActiveTab('content');
      } else if (validationErrors.includes('categories')) {
        setActiveTab('basis');
      } else if (validationErrors.includes('title')) {
        methods.setFocus('title');
        setActiveTab('basis');
      } else if (validationErrors.includes('urls')) {
        methods.setFocus('content.urls.0.url');
        setActiveTab('content');
      }
      return;
    }

    try {
      const saved = mode === 'create' ? await createEvent(payload) : await updateEvent(contentId as string, payload);
      setStatus({ kind: 'success', text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess') });
      if (mode === 'create') {
        await navigate({ to: '/admin/events/$id', params: { id: saved.id } });
      }
    } catch (saveError) {
      setStatus({ kind: 'error', text: errorMessage(pt, saveError, 'messages.saveError') });
    }
  });

  const remove = async () => {
    if (!contentId || !globalThis.confirm(pt('actions.deleteConfirm'))) {
      return;
    }

    try {
      await deleteEvent(contentId);
      await navigate({ to: '/admin/content' });
    } catch (deleteError) {
      setStatus({ kind: 'error', text: errorMessage(pt, deleteError, 'messages.deleteError') });
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={mode === 'create' ? pt('detail.createDescription') : pt('detail.editDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
            {mode === 'edit' ? (
              <Button type="button" variant="destructive" onClick={() => void remove()}>
                {pt('actions.delete')}
              </Button>
            ) : null}
            <Button type="submit" form={formId}>
              {pt('actions.save')}
            </Button>
          </div>
        }
      >
        <StudioMediaPickerOverlay
          assets={mediaAssets.map(toEventsMediaPickerSummary)}
          feedbackMessage={mediaPickerFeedback.message}
          feedbackTone={mediaPickerFeedback.tone}
          isAssetSelectable={(asset) =>
            isAssetSelectable({
              ...asset,
              metadata: {
                title: asset.title,
                altText: '',
                description: '',
                copyright: '',
                license: '',
              },
            })
          }
          isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
          isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
          isSupportedUploadFile={isSupportedUploadFile}
          labels={mediaPickerLabels}
          metadataDraft={mediaPicker.metadataDraft}
          mode={mediaPicker.mode}
          onBackFromReview={mediaPicker.goBackFromReview}
          onChangeMode={(pickerMode) =>
            pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
          }
          onClose={mediaPicker.close}
          onConfirmSelection={() => void mediaPicker.confirmSelection()}
          onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
          onOpenMediaManagement={(assetId) => void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })}
          onSearchValueChange={mediaPicker.setSearchValue}
          onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
          onUploadFile={(file) => void mediaPicker.uploadFile(file)}
          open={mediaPicker.open}
          reviewAsset={mediaPicker.reviewAsset}
          reviewSource={mediaPicker.reviewSource}
          searchValue={mediaPicker.searchValue}
          uploadPhase={mediaPicker.uploadPhase}
        />
        <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-5">
          {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as EventsDetailTabId)} className="space-y-0">
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <Select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 rounded-xl border-border/70 bg-card"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as EventsDetailTabId)}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </Select>
            </label>
            <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
              {tabs.map((tab) => {
                const TabIcon = eventsTabIconMap[tab.id];
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {tabs.map((tab) => {
              const shouldKeepMounted = visitedTabs.includes(tab.id) && tab.id !== activeTab;

              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount={shouldKeepMounted || undefined}
                  className="mt-0 data-[state=inactive]:hidden"
                >
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
                    <section
                      aria-label={tab.title}
                      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-1">
                        <h2 className="text-base font-semibold text-foreground">{tab.title}</h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
                      </div>
                    </section>
                    {tab.id === 'basis' ? (
        <EventsDetailBasisTab
          availableCategories={categoryOptions}
          availablePois={poiOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          loadedItem={loadedItem}
          mode={mode}
          poiOptionsError={poiOptionsError}
          poiOptionsLoading={poiOptionsLoading}
          pt={pt}
        />
                    ) : null}
                    {tab.id === 'content' ? (
                      <EventsDetailContentTab
                        dateEndInput={dateEndInput}
                        dateInputsInvalid={invalidDateInputs}
                        dateStartInput={dateStartInput}
                        onDateEndInputChange={(nextValue) => updateDateField('dateEnd', nextValue)}
                        onDateStartInputChange={(nextValue) => updateDateField('dateStart', nextValue)}
                        onOpenMediaPicker={(pickerMode) =>
                          pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
                        }
                        pt={pt}
                      />
                    ) : null}
                    {tab.id === 'settings' ? <EventsDetailSettingsTab pt={pt} /> : null}
                    {tab.id === 'history' ? <EventsDetailHistoryTab pt={pt} /> : null}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
