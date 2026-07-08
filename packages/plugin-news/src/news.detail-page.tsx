import * as React from 'react';
import { FormProvider, useForm, type FieldNamesMarkedBoolean } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  fromDatetimeLocalValue,
  getHostMediaAsset,
  listHostMediaAssets,
  toDatetimeLocalValue,
  translatePluginKey,
  updateHostMediaAsset,
  uploadHostMediaFile,
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
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerOverlayLabels,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';

import {
  createNews,
  deleteNews,
  getNews,
  listNewsCategories,
  NewsApiError,
  saveNewsEditorItem,
  updateNews,
} from './news.api.js';
import { NewsDetailBasisTab } from './news.detail-basis-tab.js';
import { NewsDetailContentTab } from './news.detail-content-tab.js';
import { NewsDetailHistoryTab } from './news.detail-history-tab.js';
import { NewsDetailSettingsTab } from './news.detail-settings-tab.js';
import {
  createDefaultNewsDetailFormValues,
  deriveDirtyNewsDetailTabs,
  mapNewsItemToDetailFormValues,
  newsDetailFormResolver,
} from './news.detail-form.js';
import {
  isSupportedUploadFile,
  mediaContentFromAsset,
  mediaContentSourceKey,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
} from './news.detail-media.helpers.js';
import { createNewsDetailTabDefinitions } from './news.detail-tabs.js';
import { getPluginNewsActionDefinition, pluginNewsActionIds } from './plugin.js';
import type {
  NewsAuthorControl,
  NewsCategoryOption,
  NewsContentItem,
  NewsDetailFormValues,
  NewsDetailTabId,
} from './news.types.js';

type StatusMessage = Readonly<{
  kind: 'success' | 'error';
  text: string;
}>;

type PluginTranslator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const errorMessageTranslationKeys: Record<string, string> = {
  config_not_found: 'messages.errors.configNotFound',
  integration_disabled: 'messages.errors.integrationDisabled',
  invalid_config: 'messages.errors.invalidConfig',
  missing_credentials: 'messages.errors.missingCredentials',
  organization_mainserver_credentials_missing: 'messages.errors.organizationMainserverCredentialsMissing',
  token_request_failed: 'messages.errors.tokenRequestFailed',
  unauthorized: 'messages.errors.unauthorized',
  forbidden: 'messages.errors.forbidden',
  graphql_error: 'messages.errors.graphqlError',
  invalid_response: 'messages.errors.invalidResponse',
  invalid_request: 'messages.errors.invalidRequest',
  csrf_validation_failed: 'messages.errors.csrfValidationFailed',
  idempotency_key_required: 'messages.errors.idempotencyKeyRequired',
  idempotency_key_reuse: 'messages.errors.idempotencyKeyReuse',
  missing_instance: 'messages.errors.missingInstance',
  network_error: 'messages.errors.networkError',
  not_found: 'messages.missingContent',
};

const detailFriendlyErrorCodes = new Set([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'invalid_request',
  'missing_credentials',
  'missing_instance',
  'organization_mainserver_credentials_missing',
  'forbidden',
]);

const resolvePluginActionLabel = (
  pt: PluginTranslator,
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => {
  const definition = getPluginNewsActionDefinition(actionId);
  const titleKey = definition?.titleKey;
  if (!titleKey) {
    return actionId;
  }

  const localTitleKey = titleKey.startsWith('news.') ? titleKey.slice('news.'.length) : undefined;
  return localTitleKey ? pt(localTitleKey) : translatePluginKey('news', titleKey);
};

const resolveNewsErrorMessage = (pt: PluginTranslator, error: unknown, fallbackKey: string) => {
  if (error instanceof NewsApiError) {
    const key = errorMessageTranslationKeys[error.code];
    if (key) {
      const genericMessage = pt(key);
      const detail = error.message.trim();
      const hasMeaningfulDetail =
        detailFriendlyErrorCodes.has(error.code) &&
        detail.length > 0 &&
        detail !== error.code &&
        detail.startsWith('http_') === false &&
        detail !== genericMessage;

      if (hasMeaningfulDetail) {
        return `${genericMessage} ${pt('messages.errors.details', { message: detail })}`;
      }

      return genericMessage;
    }
  }
  return pt(fallbackKey);
};

const parseDatetimeLocalInput = (value: string, referenceValue?: string) => {
  if (value.trim().length === 0) {
    return { isInvalid: false, normalizedValue: '' };
  }

  const normalizedValue = fromDatetimeLocalValue(value, referenceValue);
  return {
    isInvalid: normalizedValue.length === 0,
    normalizedValue,
  };
};

type NewsMediaPickerAsset = StudioMediaPickerAssetDetail;

const readDetailFileName = (asset: Pick<HostMediaAssetDetail, 'id' | 'storageKey'>): string => {
  const storageKeyParts = asset.storageKey.split('/');
  const fileName = storageKeyParts[storageKeyParts.length - 1]?.trim();
  return fileName && fileName.length > 0 ? fileName : asset.id;
};

const toNewsMediaPickerSummary = (asset: HostMediaAssetListItem): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toNewsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: HostMediaAssetListItem
): NewsMediaPickerAsset => {
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

const createNewsMediaPickerLabels = (pt: PluginTranslator): StudioMediaPickerOverlayLabels => ({
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

const resolveNewsMediaPickerFeedback = (
  pt: PluginTranslator,
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

const isDirtyFieldTree = (
  value: FieldNamesMarkedBoolean<NewsDetailFormValues> | undefined
): value is FieldNamesMarkedBoolean<NewsDetailFormValues> => Boolean(value);

type NewsTabIconProps = Readonly<{ className?: string }>;

const NewsTabBasisIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M7 4.75h7.5L19 9.25v9A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25v-11.5A1.75 1.75 0 0 1 6.75 5Z" />
    <path d="M14 4.75v4.5h4.5" />
    <path d="M8.5 12h7" />
    <path d="M8.5 15.5h7" />
  </svg>
);

const NewsTabContentIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4.5" y="5" width="15" height="14" rx="2" />
    <path d="m8 14 2.5-2.5 2 2 2.5-3 3 4.5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </svg>
);

const NewsTabSettingsIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7h10" />
    <path d="M4 17h16" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
);

const NewsTabHistoryIcon = ({ className }: NewsTabIconProps) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 5.5v3.7h3.7" />
    <path d="M12 8.5v4l2.5 1.5" />
  </svg>
);

const newsTabIconMap = {
  basis: NewsTabBasisIcon,
  content: NewsTabContentIcon,
  settings: NewsTabSettingsIcon,
  history: NewsTabHistoryIcon,
} as const satisfies Record<NewsDetailTabId, (props: NewsTabIconProps) => React.JSX.Element>;

export const NewsDetailPage = ({
  mode,
  contentId,
  initialAuthor,
  authorControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  initialAuthor?: string;
  authorControl?: NewsAuthorControl;
}>) => {
  const navigate = useNavigate();
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('news', key, variables),
    []
  );
  const deleteLabel = resolvePluginActionLabel(pt, pluginNewsActionIds.delete);
  const headerSaveLabel = pt('actions.save');
  const [activeTab, setActiveTab] = React.useState<NewsDetailTabId>('basis');
  const [isLoading, setIsLoading] = React.useState(mode === 'edit');
  const [statusMessage, setStatusMessage] = React.useState<StatusMessage | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [loadedItem, setLoadedItem] = React.useState<NewsContentItem | null>(null);
  const [scheduledPublicationInput, setScheduledPublicationInput] = React.useState('');
  const [invalidScheduledPublicationInput, setInvalidScheduledPublicationInput] = React.useState(false);
  const [categoryOptions, setCategoryOptions] = React.useState<readonly NewsCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const [mediaAssets, setMediaAssets] = React.useState<readonly HostMediaAssetListItem[]>([]);
  const [visitedTabs, setVisitedTabs] = React.useState<readonly NewsDetailTabId[]>(['basis']);
  const editLoadRequestIdRef = React.useRef(0);
  const formId = React.useId();
  const resolvedInitialAuthor = (authorControl?.value ?? initialAuthor ?? '').trim();

  const methods = useForm<NewsDetailFormValues>({
    defaultValues: createDefaultNewsDetailFormValues(resolvedInitialAuthor),
    resolver: newsDetailFormResolver,
  });
  const {
    formState,
    reset,
    setValue,
  } = methods;

  const refreshMediaAssets = React.useCallback(async () => {
    try {
      const assets = await listHostMediaAssets({ fetch: globalThis.fetch.bind(globalThis), visibility: 'public' });
      setMediaAssets(assets);
      return assets;
    } catch {
      setMediaAssets([]);
      return [];
    }
  }, []);
  const mediaPickerLabels = React.useMemo(() => createNewsMediaPickerLabels(pt), [pt]);

  const isAssetSelectable = React.useCallback((asset: NewsMediaPickerAsset) => {
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

    const existingSources = new Set((methods.getValues('contentMedia') ?? []).map(mediaContentSourceKey).filter(Boolean));
    return existingSources.has(mediaContentSourceKey(nextMedia)) === false;
  }, [methods]);

  const mediaPicker = useStudioMediaPickerOverlay<NewsMediaPickerAsset>({
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

      const currentMedia = methods.getValues('contentMedia') ?? [];
      methods.setValue('contentMedia', [...currentMedia, nextMedia], { shouldDirty: true });
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
      return { assetId: uploaded.assetId };
    },
    loadAsset: async (assetId) => {
      const detail = await getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId });
      const summary = mediaAssets.find((asset) => asset.id === assetId);
      return toNewsMediaPickerDetail(detail, summary);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const detail = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        visibility: 'public',
        metadata,
      });
      await refreshMediaAssets();
      const summary = mediaAssets.find((asset) => asset.id === assetId);
      return toNewsMediaPickerDetail(detail, summary);
    },
  });
  const mediaPickerFeedback = React.useMemo(
    () => resolveNewsMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  const dirtyTabs = React.useMemo(
    () =>
      formState.isDirty
        ? deriveDirtyNewsDetailTabs(
            (isDirtyFieldTree(formState.dirtyFields) ? formState.dirtyFields : {}) as Parameters<
              typeof deriveDirtyNewsDetailTabs
            >[0]
          )
        : {
            basis: false,
            content: false,
            settings: false,
            history: false,
          },
    [formState.dirtyFields, formState.isDirty]
  );

  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    const normalizedInitialAuthor = resolvedInitialAuthor;
    if (normalizedInitialAuthor.length === 0) {
      return;
    }

    if (formState.dirtyFields.author) {
      return;
    }

    setValue('author', normalizedInitialAuthor, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [formState.dirtyFields.author, mode, resolvedInitialAuthor, setValue]);

  React.useEffect(() => {
    let active = true;

    void listNewsCategories()
      .then((categories) => {
        if (!active) {
          return;
        }
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setCategoryOptions([]);
        setCategoryOptionsError(resolveNewsErrorMessage(pt, error, 'messages.categoryOptionsLoadError'));
      })
      .finally(() => {
        if (active) {
          setCategoryOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pt]);

  React.useEffect(() => {
    void refreshMediaAssets();
  }, [refreshMediaAssets]);

  React.useEffect(() => {
    if (mode !== 'edit') {
      return;
    }

    if (!contentId) {
      setIsLoading(false);
      setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
      return;
    }

    const requestId = ++editLoadRequestIdRef.current;
    let active = true;

    void getNews(contentId)
      .then((item) => {
        if (!active || requestId !== editLoadRequestIdRef.current) {
          return;
        }

        const nextValues = mapNewsItemToDetailFormValues(item);
        reset(nextValues);
        setScheduledPublicationInput(toDatetimeLocalValue(nextValues.scheduledPublicationAt));
        setInvalidScheduledPublicationInput(false);
        setLoadedItem(item);
      })
      .catch((error: unknown) => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.loadError') });
        }
      })
      .finally(() => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode, pt, reset]);

  const saveCurrentItem = methods.handleSubmit(async (values) => {
    setStatusMessage(null);

    if (mode === 'edit' && !contentId) {
      setStatusMessage({ kind: 'error', text: pt('messages.missingContent') });
      return;
    }

    try {
      const saved = await saveNewsEditorItem({
        contentId,
        values,
        existingItem: loadedItem ?? null,
      }, {
        createNews,
        updateNews,
      });

      if (mode === 'create') {
        await navigate({ to: '/admin/content' });
        return;
      }

      const nextValues = mapNewsItemToDetailFormValues(saved);
      reset(nextValues);
      setLoadedItem(saved);
      setScheduledPublicationInput(toDatetimeLocalValue(nextValues.scheduledPublicationAt));
      setInvalidScheduledPublicationInput(false);
      setStatusMessage({ kind: 'success', text: pt('messages.updateSuccess') });
    } catch (error) {
      setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.saveError') });
    }
  }, () => {
    setStatusMessage({ kind: 'error', text: pt('messages.validationError') });
  });

  const onDelete = async () => {
    if (!contentId || deletePending) {
      return;
    }

    if (globalThis.window.confirm(pt('actions.deleteConfirm')) === false) {
      return;
    }

    setDeletePending(true);

    try {
      await deleteNews(contentId);
      await navigate({ to: '/admin/content' });
    } catch (error) {
      setStatusMessage({ kind: 'error', text: resolveNewsErrorMessage(pt, error, 'messages.deleteError') });
    } finally {
      setDeletePending(false);
    }
  };

  React.useEffect(() => {
    setVisitedTabs((current) => (current.includes(activeTab) ? current : [...current, activeTab]));
  }, [activeTab]);

  const warmTab = React.useCallback((tabId: NewsDetailTabId) => {
    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
  }, []);

  const handleTabChange = React.useCallback(
    (nextTab: NewsDetailTabId) => {
      if (nextTab === activeTab) {
        return;
      }
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  if (isLoading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  const tabs = createNewsDetailTabDefinitions([
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
          authorControl={authorControl}
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
          mode={mode}
          pt={pt}
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

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
      actions={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" form={formId}>
            {headerSaveLabel}
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' ? (
            <Button variant="destructive" type="button" onClick={onDelete} disabled={deletePending}>
              {deleteLabel}
            </Button>
          ) : null}
        </div>
      }
    >
      <FormProvider {...methods}>
        <StudioMediaPickerOverlay
          assets={mediaAssets.map(toNewsMediaPickerSummary)}
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
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void saveCurrentItem();
          }}
        >
          {statusMessage ? <StudioFormSummary kind={statusMessage.kind}>{statusMessage.text}</StudioFormSummary> : null}
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as NewsDetailTabId)} className="space-y-0">
            <label className="block md:hidden">
              <span className="sr-only">{pt('tabs.mobileLabel')}</span>
              <Select
                aria-label={pt('tabs.mobileLabel')}
                className="h-11 rounded-xl border-border/70 bg-card"
                value={activeTab}
                onChange={(event) => handleTabChange(event.target.value as NewsDetailTabId)}
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
                const TabIcon = newsTabIconMap[tab.id];
                const isActive = tab.id === activeTab;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    onMouseEnter={() => warmTab(tab.id)}
                    onFocus={() => warmTab(tab.id)}
                    className={`relative z-10 gap-2 rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none ${
                      isActive ? 'mb-[-1px] border-primary text-primary' : 'border-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TabIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                      {tab.hasChanges && tab.changeLabel ? (
                        <span className="text-xs font-medium text-foreground">{tab.changeLabel}</span>
                      ) : null}
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
                      aria-label={tab.title ? String(tab.title) : tab.label}
                      className="flex flex-col gap-3 border-0 bg-transparent p-0 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-1">
                        <h2 className="text-base font-semibold text-foreground">{tab.title ?? tab.label}</h2>
                        {tab.description ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">{tab.description}</p>
                        ) : null}
                      </div>
                      {tab.actions ? <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">{tab.actions}</div> : null}
                    </section>
                    {tab.panel}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </form>
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
