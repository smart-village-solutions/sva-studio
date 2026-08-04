import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  getHostMediaAssetFileName,
  alignHostMediaReferencesByOrder,
  listHostMediaAssets,
  listHostMediaReferencesByTarget,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  saveContentWithHostMediaReferences,
  subscribeSessionAccessSnapshot,
  updateHostMediaAsset,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetDetail,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  Button,
  isPersistableContentMediaUrl,
  Select,
  StudioDetailTabIcon,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
  type ContentMediaAssetSnapshot,
  type ContentMediaUsage,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';

import {
  createPoi,
  deletePoi,
  getPoi,
  listPoiCategories,
  PoiApiError,
  updatePoi,
} from './poi.api.js';
import { PoiDetailBasisTab } from './poi.detail-basis-tab.js';
import { PoiDetailContentTab } from './poi.detail-content-tab.js';
import {
  createDefaultPoiDetailFormValues,
  mapPoiDetailFormValuesToInput,
  mapPoiItemToDetailFormValues,
  parsePoiPayloadText,
  type PoiDetailFormValues,
} from './poi.detail-form.js';
import { PoiDetailHistoryTab } from './poi.detail-history-tab.js';
import {
  isSupportedUploadFile,
  mediaContentSourceKey,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
} from './poi.detail-media.helpers.js';
import { PoiDetailSettingsTab } from './poi.detail-settings-tab.js';
import { createPoiDetailTabDefinitions, type PoiDetailTabId } from './poi.detail-tabs.js';
import type { PoiCategoryOption, PoiContentItem } from './poi.types.js';
import { isHttpsUrl, validatePoiForm } from './poi.validation.js';
import {
  poiAssetToUsage,
  poiMediaContentsToUsages,
  poiMediaUsagesToContents,
} from './poi.content-media-adapter.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

type PoiMediaPickerAsset = StudioMediaPickerAssetDetail;

const errorMessage = (
  pt: ReturnType<typeof usePluginTranslation>,
  error: unknown,
  fallbackKey: string
) => (error instanceof PoiApiError ? error.message : pt(fallbackKey));

const renderPoiTabPanel = ({
  title,
  description,
  panel,
}: Readonly<{
  title: string;
  description: string;
  panel: React.JSX.Element;
}>) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </section>
    {panel}
  </div>
);

const PoiTabTriggerLabel = ({ label }: Readonly<{ label: string }>) => <span>{label}</span>;

const toPoiMediaPickerSummary = (asset: HostMediaAssetListItem): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toPoiMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem,
  persistentUrl?: string | null
): PoiMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    persistentUrl,
    metadata: {
      title,
      altText: asset.metadata.altText?.trim() ?? '',
      description: asset.metadata.description?.trim() ?? '',
      copyright: asset.metadata.copyright?.trim() ?? '',
      license: asset.metadata.license?.trim() ?? '',
    },
  };
};

const createPoiMediaPickerLabels = (
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
    title: pt('fields.name'),
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

const resolvePoiMediaPickerFeedback = (
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

export function PoiDetailPage({
  mode,
  contentId,
  instanceId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
}>) {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const formId = React.useId();
  const methods = useForm<PoiDetailFormValues>({
    defaultValues: createDefaultPoiDetailFormValues(),
  });
  const { reset } = methods;
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<PoiContentItem | null>(null);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [retryReferenceSync, setRetryReferenceSync] = React.useState<(() => Promise<void>) | null>(null);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const mediaCapabilities = React.useMemo(() => resolveContentMediaCapabilities({ canEditContent: true, permissionActions: sessionAccess.permissionActions }), [sessionAccess.permissionActions]);
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;
  const mediaAssetsRef = React.useRef<readonly HostMediaAssetListItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<PoiDetailTabId>('basis');
  const [visitedTabs, setVisitedTabs] = React.useState<readonly PoiDetailTabId[]>(['basis']);
  const [categoryOptions, setCategoryOptions] = React.useState<readonly PoiCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const mediaPickerLabels = React.useMemo(() => createPoiMediaPickerLabels(pt), [pt]);
  const focusFieldById = React.useCallback((fieldId: string) => {
    globalThis.setTimeout(() => {
      globalThis.document.getElementById(fieldId)?.focus();
    }, 0);
  }, []);

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        instanceId,
        visibility: 'public',
      });
      mediaAssetsRef.current = assets;
      setMediaAssets(assets);
      return assets;
    } catch {
      mediaAssetsRef.current = [];
      setMediaAssets([]);
      return [];
    }
  }, [instanceId]);

  const isAssetSelectable = React.useCallback(
    (asset: PoiMediaPickerAsset) => {
      if (!asset.persistentUrl) {
        return mediaUsages.every((usage) => usage.assetId !== asset.id);
      }
      if (!isPersistableContentMediaUrl(asset.persistentUrl)) return false;

      const existingSources = new Set(
        (methods.getValues('content.mediaContents') ?? [])
          .map(mediaContentSourceKey)
          .filter(Boolean)
      );
      return existingSources.has(asset.persistentUrl) === false;
    },
    [mediaUsages, methods]
  );

  const mediaPicker = useStudioMediaPickerOverlay<PoiMediaPickerAsset>({
    onAccept: (asset) => {
      if (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl)) return;
      const usage = poiAssetToUsage({
        assetId: asset.id,
        persistentUrl: asset.persistentUrl,
        previewUrl: asset.previewUrl,
        metadata: { ...asset.metadata, fileName: asset.fileName },
        sortOrder: mediaUsages.length,
      });
      const nextUsages = [...mediaUsages, usage];
      setRequiresReferenceSync(true);
      setMediaUsages(nextUsages);
      methods.setValue('content.mediaContents', poiMediaUsagesToContents(nextUsages), {
        shouldDirty: true,
      });
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
        instanceId,
      });
      const assets = await refreshMediaAssets();
      mediaAssetsRef.current = assets;
      return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
    },
    loadAsset: async (assetId) => {
      const [detail, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId, instanceId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId, instanceId }),
      ]);
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      return toPoiMediaPickerDetail(detail, summary, delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl) ? delivery.deliveryUrl : null);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const detail = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        metadata,
        visibility: 'public',
        instanceId,
      });
      const assets = await refreshMediaAssets();
      mediaAssetsRef.current = assets;
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      const delivery = await getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId, instanceId });
      return toPoiMediaPickerDetail(detail, summary, delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl) ? delivery.deliveryUrl : null);
    },
  });
  const mediaPickerFeedback = React.useMemo(
    () => resolvePoiMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  React.useEffect(() => {
    void listPoiCategories()
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
    void Promise.all([
      getPoi(contentId),
      listHostMediaReferencesByTarget({
        fetch: globalThis.fetch.bind(globalThis), targetType: 'poi.point-of-interest', targetId: contentId, instanceId,
      }),
    ])
      .then(([item, references]) => {
        if (!active) {
          return;
        }
        reset(mapPoiItemToDetailFormValues(item));
        const mediaContents = item.mediaContents ?? [];
        setMediaUsages(poiMediaContentsToUsages(mediaContents, alignHostMediaReferencesByOrder({
          itemCount: mediaContents.length, role: 'gallery_item', references,
        })));
        setRequiresReferenceSync(references.length > 0);
        setLoadedItem(item);
        setLoading(false);
      })
      .catch((loadError) => {
        if (active) {
          setStatus({
            kind: 'error',
            text: errorMessage(pt, loadError, 'messages.missingContent'),
          });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, instanceId, mode, pt, reset]);

  const tabs = createPoiDetailTabDefinitions(pt);

  const handleTabChange = React.useCallback(
    (tabId: PoiDetailTabId) => {
      if (tabId === activeTab) {
        return;
      }
      setActiveTab(tabId);
    },
    [activeTab]
  );

  const warmTab = React.useCallback((tabId: PoiDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  const submit = methods.handleSubmit(async (values) => {
    methods.clearErrors();
    setStatus(null);
    const payload = parsePoiPayloadText(values.content.payloadText);

    if (payload === undefined) {
      methods.setError('content.payloadText', { type: 'manual', message: 'payload' });
      setActiveTab('settings');
      methods.setFocus('content.payloadText');
      return;
    }

    const mutation = mapPoiDetailFormValuesToInput(values, payload);
    const validationErrors = validatePoiForm(mutation);

    if (validationErrors.length > 0) {
      setStatus({ kind: 'error', text: pt('messages.validationError') });
      if (validationErrors.includes('name')) {
        methods.setError('name', { type: 'manual', message: 'name' });
        methods.setFocus('name');
        setActiveTab('basis');
      }
      if (validationErrors.includes('categories')) {
        methods.setError('basis.categories', { type: 'manual', message: 'categories' });
        if (!validationErrors.includes('name')) {
          methods.setFocus('basis.categories');
        }
        setActiveTab('basis');
      }
      if (validationErrors.includes('webUrls')) {
        methods.setError('content.webUrls.0.url', { type: 'manual', message: 'webUrls' });
        if (!validationErrors.includes('name') && !validationErrors.includes('categories')) {
          methods.setFocus('content.webUrls.0.url');
        }
        setActiveTab('content');
      }
      if (validationErrors.includes('contact.webUrls')) {
        methods.setError('content.contact.webUrls.0.url', { type: 'manual', message: 'webUrls' });
        setActiveTab('content');
        focusFieldById('poi-contact-url');
      }
      if (validationErrors.includes('addresses')) {
        methods.setError('content.addresses.0.geoLocation.latitude', {
          type: 'manual',
          message: 'addresses',
        });
        setActiveTab('content');
      }
      if (validationErrors.includes('location')) {
        methods.setError('content.location.geoLocation.latitude', {
          type: 'manual',
          message: 'location',
        });
        setActiveTab('content');
      }
      if (validationErrors.includes('priceInformations')) {
        methods.setError('content.prices.0.amount', {
          type: 'manual',
          message: 'priceInformations',
        });
        setActiveTab('content');
      }
      if (validationErrors.includes('mediaContents')) {
        const invalidMediaIndex = values.content.mediaContents.findIndex((entry) => {
          const url = entry.sourceUrl?.url?.trim() ?? '';
          return url.length > 0 && isHttpsUrl(url) === false;
        });
        const mediaIndex = invalidMediaIndex >= 0 ? invalidMediaIndex : 0;
        methods.setError(`content.mediaContents.${mediaIndex}.sourceUrl.url`, {
          type: 'manual',
          message: 'webUrls',
        });
        setActiveTab('content');
        const invalidUsage = mediaUsages[mediaIndex];
        if (invalidUsage) {
          focusFieldById(`content-media-${invalidUsage.uiId}-url`);
        }
      }
      if (validationErrors.includes('operatingCompany.address')) {
        methods.setError('content.operator.address.geoLocation.latitude', {
          type: 'manual',
          message: 'geoLocation',
        });
        methods.setError('content.operator.address.geoLocation.longitude', {
          type: 'manual',
          message: 'geoLocation',
        });
        setActiveTab('content');
        focusFieldById('poi-operator-latitude');
      }
      if (validationErrors.includes('operatingCompany.contact.webUrls')) {
        methods.setError('content.operator.contact.webUrls.0.url', {
          type: 'manual',
          message: 'webUrls',
        });
        setActiveTab('content');
        focusFieldById('poi-operator-url');
      }
      return;
    }

    try {
      const saveContent = () => mode === 'create' ? createPoi(mutation) : updatePoi(contentId as string, mutation);
      const result = requiresReferenceSync
        ? await saveContentWithHostMediaReferences({
            fetch: globalThis.fetch.bind(globalThis), saveContent, getTargetId: (saved) => saved.id,
            targetType: 'poi.point-of-interest', instanceId,
            references: mediaUsages.flatMap((usage) => usage.assetId ? [{ assetId: usage.assetId, role: 'gallery_item', sortOrder: usage.sortOrder }] : []),
          })
        : { status: 'complete' as const, saved: await saveContent() };
      const saved = result.saved;
      if (result.status === 'reference_failed') {
        setRetryReferenceSync(() => result.retryReferenceSync);
        setMediaUsages((current) => current.map((usage) => usage.assetId ? { ...usage, referenceStatus: 'failed' } : usage));
        setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') });
        return;
      }
      setRetryReferenceSync(null);
      setMediaUsages((current) => current.map((usage) => usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage));
      setStatus({
        kind: 'success',
        text: mode === 'create' ? pt('messages.createSuccess') : pt('messages.updateSuccess'),
      });
      if (mode === 'create') {
        await navigate({ to: '/admin/poi/$id', params: { id: saved.id } });
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
      await deletePoi(contentId);
      await navigate({ to: '/admin/content' });
    } catch (deleteError) {
      setStatus({ kind: 'error', text: errorMessage(pt, deleteError, 'messages.deleteError') });
    }
  };

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  const tabPanels = {
    basis: (
      <PoiDetailBasisTab
        availableCategories={categoryOptions}
        categoryOptionsError={categoryOptionsError}
        categoryOptionsLoading={categoryOptionsLoading}
        loadedItem={loadedItem}
        mode={mode}
        pt={pt}
      />
    ),
    content: (
      <PoiDetailContentTab
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaUsages={mediaUsages}
        onChangeMediaUsages={setMediaUsages}
        onLoadAssetSnapshot={async (usage): Promise<ContentMediaAssetSnapshot> => {
          if (!usage.assetId) throw new Error('missing_asset_id');
          const [asset, delivery] = await Promise.all([
            getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId, instanceId }),
            getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId: usage.assetId, instanceId }),
          ]);
          if (delivery.isPublicUrl !== true || !isPersistableContentMediaUrl(delivery.deliveryUrl)) throw new Error('asset_unavailable');
          return {
            persistentUrl: delivery.deliveryUrl,
            altText: asset.metadata.altText ?? asset.metadata.description ?? '',
            caption: asset.metadata.description ?? '',
            credit: asset.metadata.copyright ?? '',
            license: asset.metadata.license ?? '',
          };
        }}
        onOpenMediaPicker={(pickerMode) =>
          pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
        }
        pt={pt}
      />
    ),
    settings: <PoiDetailSettingsTab pt={pt} />,
    history: <PoiDetailHistoryTab contentId={contentId} pt={pt} />,
  } as const satisfies Record<PoiDetailTabId, React.JSX.Element>;

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={
          mode === 'create' ? pt('detail.createDescription') : pt('detail.editDescription')
        }
        primaryAction={
          <Button type="submit" form={formId}>
            {pt('actions.save')}
          </Button>
        }
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
          </div>
        }
      >
        <StudioMediaPickerOverlay
          assets={mediaAssets.map(toPoiMediaPickerSummary)}
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
          isMetadataEditable={canUpdateMedia}
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
          onOpenMediaManagement={(assetId) =>
            void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
          }
          onSearchValueChange={mediaPicker.setSearchValue}
          onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
          onUploadFile={(file) => void mediaPicker.uploadFile(file)}
          open={mediaPicker.open}
          reviewAsset={mediaPicker.reviewAsset}
          reviewSource={mediaPicker.reviewSource}
          searchValue={mediaPicker.searchValue}
          uploadPhase={mediaPicker.uploadPhase}
        />
        <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-5" noValidate>
          {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
          {retryReferenceSync ? (
            <Button type="button" variant="outline" onClick={() => void retryReferenceSync().then(() => {
              setRetryReferenceSync(null);
              setMediaUsages((current) => current.map((usage) => usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage));
              setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') });
            }, () => setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') }))}>
              {pt('messages.mediaReferenceRetry')}
            </Button>
          ) : null}
          <Tabs
            value={activeTab}
            onValueChange={(value) => handleTabChange(value as PoiDetailTabId)}
            className="space-y-0"
          >
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <Select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 rounded-xl border-border/70 bg-card"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as PoiDetailTabId)}
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
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive
                        ? 'mb-[-1px] border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <StudioDetailTabIcon name={tab.id} />
                      <PoiTabTriggerLabel label={tab.label} />
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
                  {renderPoiTabPanel({
                    title: tab.title,
                    description: tab.description,
                    panel: tabPanels[tab.id],
                  })}
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
