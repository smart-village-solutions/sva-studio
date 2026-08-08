import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import {
  getHostMediaAsset,
  getHostMediaDelivery,
  getHostMediaAssetFileName,
  listHostMediaReferencesByTarget,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  saveContentWithHostMediaReferences,
  subscribeSessionAccessSnapshot,
  alignHostMediaReferencesByOrder,
  updateHostMediaAsset,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetDetail,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioConfirmDialog,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  contentMediaUsageToReference,
  isPersistableContentMediaUrl,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  toContentMediaAssetSnapshot,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';
import React from 'react';
import { createGenericItem, updateGenericItem } from './generic-items.api.js';
import {
  genericItemMediaContentsToUsages,
  genericItemMediaUsagesToContents,
} from './generic-items.content-media-adapter.js';

import {
  createDefaultGenericItemsDetailFormValues,
  mapGenericItemsDetailFormValuesToInput,
  mapGenericItemToDetailFormValues,
} from './generic-items.detail-form.js';
import {
  isSupportedUploadFile,
  mediaContentFromAsset,
  readAssetFileName,
  readAssetTitle,
  uploadPhaseMessageKey,
} from './generic-items.detail-media.helpers.js';
import { createEmptyMediaContent } from './generic-items.detail-media-upload.js';
import { createGenericItemsDetailLabels } from './generic-items.detail-page.labels.js';
import {
  useGenericItemsCategoryOptions,
  useGenericItemsDetailActions,
  useGenericItemsDetailLoader,
  useGenericItemsMediaAssets,
  type StatusMessage,
} from './generic-items.detail-page.logic.js';
import { GenericItemsDetailTabs } from './generic-items.detail-page.tabs.js';
import {
  genericItemsDetailFormSchema,
  type GenericItemsDetailFormValues,
} from './generic-items.validation.js';

const genericItemsListLink = {
  to: '/admin/content',
  search: { type: 'generic-items.generic-item' },
} as const;

const getFieldErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }

  return typeof error.message === 'string' && error.message.length > 0 ? error.message : undefined;
};

const createSummaryErrors = (
  errors: ReturnType<typeof useForm<GenericItemsDetailFormValues>>['formState']['errors']
) => {
  const entries = [
    getFieldErrorMessage(errors.title)
      ? { field: 'generic-item-title', message: getFieldErrorMessage(errors.title) }
      : null,
    getFieldErrorMessage(errors.genericType)
      ? { field: 'generic-item-type', message: getFieldErrorMessage(errors.genericType) }
      : null,
    getFieldErrorMessage(errors.categories)
      ? { field: 'generic-item-categories', message: getFieldErrorMessage(errors.categories) }
      : null,
    getFieldErrorMessage(errors.payloadText)
      ? { field: 'generic-item-payload', message: getFieldErrorMessage(errors.payloadText) }
      : null,
  ];

  return entries.filter((entry): entry is { field: string; message: string } => entry !== null);
};

type GenericItemsMediaPickerAsset = StudioMediaPickerAssetDetail;
const genericItemsMediaReferenceTargetType = 'generic-items.generic-item';

export const resolveGenericItemsPersistentDeliveryUrl = (
  delivery: Readonly<{ deliveryUrl: string; isPublicUrl?: boolean }>
): string | null =>
  delivery.isPublicUrl === true && isPersistableContentMediaUrl(delivery.deliveryUrl)
    ? delivery.deliveryUrl
    : null;

const toGenericItemsMediaPickerSummary = (
  asset: Parameters<typeof readAssetTitle>[0]
): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toGenericItemsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: Parameters<typeof readAssetTitle>[0],
  persistentUrl?: string | null
): GenericItemsMediaPickerAsset => {
  const fileName = summary ? readAssetFileName(summary) : getHostMediaAssetFileName(asset);
  const title = asset.metadata.title?.trim() || (summary ? readAssetTitle(summary) : fileName);

  return {
    id: asset.id,
    title,
    fileName,
    previewUrl: asset.previewUrl?.trim() || summary?.previewUrl?.trim() || null,
    persistentUrl: persistentUrl ?? undefined,
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

const createGenericItemsMediaPickerLabels = (
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

const resolveGenericItemsMediaPickerFeedback = (
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

const DetailPageActions = ({
  disableActions,
  mode,
  deleting,
  onDelete,
  pt,
}: Readonly<{
  disableActions: boolean;
  deleting: boolean;
  mode: 'create' | 'edit';
  onDelete: () => void;
  pt: (key: string) => string;
}>) => (
  <div className="flex gap-2">
    <Button asChild variant="outline">
      <Link {...genericItemsListLink}>{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' ? (
      <Button
        type="button"
        variant="outline"
        disabled={disableActions || deleting}
        onClick={onDelete}
      >
        {pt('actions.delete')}
      </Button>
    ) : null}
  </div>
);

export function GenericItemsDetailPage({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const labels = React.useMemo(() => createGenericItemsDetailLabels(pt), [pt]);
  const mediaPickerLabels = React.useMemo(() => createGenericItemsMediaPickerLabels(pt), [pt]);
  const methods = useForm<GenericItemsDetailFormValues>({
    resolver: zodResolver(genericItemsDetailFormSchema),
    defaultValues: createDefaultGenericItemsDetailFormValues(),
  });
  const summaryErrors = React.useMemo(
    () => createSummaryErrors(methods.formState.errors),
    [methods.formState.errors]
  );
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const [loadedItem, setLoadedItem] = React.useState<
    import('./generic-items.api-types.js').GenericItemContentItem | null
  >(null);
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [mediaUsages, setMediaUsages] = React.useState<readonly ContentMediaUsage[]>([]);
  const [requiresReferenceSync, setRequiresReferenceSync] = React.useState(false);
  const [retryReferenceSync, setRetryReferenceSync] = React.useState<(() => Promise<void>) | null>(
    null
  );
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const mediaCapabilities = React.useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent: sessionAccess.permissionActions.includes(
          mode === 'create' ? 'generic-items.create' : 'generic-items.update'
        ),
        permissionActions: sessionAccess.permissionActions,
      }),
    [mode, sessionAccess.permissionActions]
  );
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;
  const { mediaAssets, refreshMediaAssets } = useGenericItemsMediaAssets();
  const mediaAssetsRef = React.useRef(mediaAssets);
  const { categoryOptions, categoryOptionsError, categoryOptionsLoading } =
    useGenericItemsCategoryOptions(pt);
  const handleLoadedItem = React.useCallback(
    (item: Parameters<typeof mapGenericItemToDetailFormValues>[0]) => {
      if (!contentId) return;
      setLoadedItem(item);
      const sourceMedia = item.mediaContents ?? [];
      setMediaUsages(genericItemMediaContentsToUsages(sourceMedia));
      void listHostMediaReferencesByTarget({
        fetch: globalThis.fetch.bind(globalThis),
        targetType: genericItemsMediaReferenceTargetType,
        targetId: contentId,
      })
        .then((references) => {
          setMediaUsages(
            genericItemMediaContentsToUsages(
              sourceMedia,
              alignHostMediaReferencesByOrder({
                itemCount: sourceMedia.length,
                role: 'gallery_item',
                references,
              })
            )
          );
          setRequiresReferenceSync(references.length > 0);
        })
        .catch(() => {
          setStatus({ kind: 'error', text: pt('messages.loadError') });
        });
    },
    [contentId, pt]
  );
  const loading = useGenericItemsDetailLoader({
    contentId,
    methods,
    mode,
    pt,
    setStatus,
    onLoaded: handleLoadedItem,
  });
  const { activeTab, deleting, handleDelete, setActiveTab } = useGenericItemsDetailActions({
    contentId,
    methods,
    mode,
    navigate,
    pt,
    setStatus,
    actingPrincipalType,
  });
  const isAssetSelectable = React.useCallback(
    (asset: GenericItemsMediaPickerAsset) => {
      if (!asset.persistentUrl) return mediaUsages.every((usage) => usage.assetId !== asset.id);
      if (!isPersistableContentMediaUrl(asset.persistentUrl)) return false;
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

      const existingSources = new Set(
        (methods.getValues('mediaContents') ?? [])
          .map((entry) => entry.sourceUrl?.url?.trim() ?? '')
          .filter((value) => value.length > 0)
      );
      return existingSources.has(nextMedia.sourceUrl?.url?.trim() ?? '') === false;
    },
    [mediaUsages, methods]
  );

  const mediaPicker = useStudioMediaPickerOverlay<GenericItemsMediaPickerAsset>({
    onAccept: (asset) => {
      if (!asset.persistentUrl || !isPersistableContentMediaUrl(asset.persistentUrl)) return;
      const persistentUrl = asset.persistentUrl;
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

      const currentMedia = methods.getValues('mediaContents') ?? [];
      methods.setValue(
        'mediaContents',
        [
          ...currentMedia,
          {
            ...createEmptyMediaContent(),
            captionText: nextMedia.captionText ?? '',
            copyright: nextMedia.copyright ?? '',
            contentType: nextMedia.contentType ?? '',
            sourceUrl: {
              url: persistentUrl,
              description: nextMedia.sourceUrl?.description ?? '',
            },
          },
        ],
        { shouldDirty: true }
      );
      setMediaUsages((current) => [
        ...current,
        {
          uiId: `generic-item-asset-${asset.id}-${current.length}`,
          assetId: asset.id,
          persistentUrl,
          previewUrl: asset.previewUrl ?? undefined,
          altText: asset.metadata.altText || asset.fileName,
          caption: asset.metadata.description || asset.title,
          credit: asset.metadata.copyright,
          license: asset.metadata.license,
          role: 'gallery_item',
          sortOrder: current.length,
          additionalData: { contentType: nextMedia.contentType ?? '', width: '', height: '' },
          assetSnapshot: toContentMediaAssetSnapshot({
            persistentUrl,
            altText: asset.metadata.altText || asset.fileName,
            caption: asset.metadata.description || asset.title,
            credit: asset.metadata.copyright,
            license: asset.metadata.license,
          }),
          referenceStatus: 'pending',
        },
      ]);
      setRequiresReferenceSync(true);
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
      const assets = await refreshMediaAssets();
      mediaAssetsRef.current = assets;
      return { assetId: uploaded.assetId, previewUrl: uploaded.previewUrl };
    },
    loadAsset: async (assetId) => {
      const [detail, delivery] = await Promise.all([
        getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId }),
        getHostMediaDelivery({ fetch: globalThis.fetch.bind(globalThis), assetId }),
      ]);
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      return toGenericItemsMediaPickerDetail(
        detail,
        summary,
        resolveGenericItemsPersistentDeliveryUrl(delivery)
      );
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const detail = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        metadata,
        visibility: 'public',
      });
      const assets = await refreshMediaAssets();
      mediaAssetsRef.current = assets;
      const summary = mediaAssetsRef.current.find((asset) => asset.id === assetId);
      const delivery = await getHostMediaDelivery({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
      });
      return toGenericItemsMediaPickerDetail(
        detail,
        summary,
        resolveGenericItemsPersistentDeliveryUrl(delivery)
      );
    },
  });

  React.useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);
  const mediaPickerFeedback = React.useMemo(
    () =>
      resolveGenericItemsMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  const onSubmit = methods.handleSubmit(async (values) => {
    setStatus(null);
    try {
      const input = {
        ...mapGenericItemsDetailFormValuesToInput(values),
        mediaContents: genericItemMediaUsagesToContents(mediaUsages),
      };
      const saveContent = () =>
        mode === 'create'
          ? createGenericItem(input, actingPrincipalType)
          : updateGenericItem(contentId ?? '', input, actingPrincipalType);
      const result = requiresReferenceSync
        ? await saveContentWithHostMediaReferences({
            fetch: globalThis.fetch.bind(globalThis),
            saveContent,
            getTargetId: (saved) => saved.id,
            targetType: genericItemsMediaReferenceTargetType,
            references: mediaUsages.flatMap((usage) => {
              const reference = contentMediaUsageToReference(usage);
              return reference ? [reference] : [];
            }),
          })
        : { status: 'complete' as const, saved: await saveContent() };
      if (result.status === 'reference_failed') {
        setRetryReferenceSync(() => result.retryReferenceSync);
        setMediaUsages((current) =>
          current.map((usage) => (usage.assetId ? { ...usage, referenceStatus: 'failed' } : usage))
        );
        setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') });
        return;
      }
      setMediaUsages((current) =>
        current.map((usage) => (usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage))
      );
      setStatus({
        kind: 'success',
        text: pt(mode === 'create' ? 'messages.createSuccess' : 'messages.updateSuccess'),
      });
      if (mode === 'create')
        await navigate({ to: '/admin/generic-items/$id', params: { id: result.saved.id } });
    } catch {
      setStatus({ kind: 'error', text: pt('messages.saveError') });
    }
  });

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
        description={
          mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')
        }
        primaryAction={
          <Button
            type="button"
            disabled={methods.formState.isSubmitting}
            onClick={() => void onSubmit()}
          >
            {mode === 'create' ? pt('actions.create') : pt('actions.update')}
          </Button>
        }
        actions={
          <DetailPageActions
            disableActions={methods.formState.isSubmitting}
            deleting={deleting}
            mode={mode}
            onDelete={() => {
              setStatus(null);
              setDeleteDialogOpen(true);
            }}
            pt={pt}
          />
        }
      >
        <StudioMediaPickerOverlay
          assets={mediaAssets.map(toGenericItemsMediaPickerSummary)}
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
          isMetadataEditable={canUpdateMedia}
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
        <StudioFormSummaryErrors errors={summaryErrors} />
        {status ? (
          <StudioFormSummary data-testid="generic-items-status" kind={status.kind}>
            {status.text}
          </StudioFormSummary>
        ) : null}
        <MainserverPrincipalControl
          id="generic-items-acting-principal"
          label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
          description={pt('principal.description')}
          value={actingPrincipalType}
          options={resolveMainserverPrincipalOptions(principalControl, {
            value: actingPrincipalType,
            label: pt(`principal.${actingPrincipalType}`),
          })}
          onChange={setActingPrincipalType}
          dataProvider={mode === 'edit' ? loadedItem?.dataProvider : undefined}
          dataProviderLabel={pt('principal.dataProvider')}
          dataProviderUnavailableLabel={pt('principal.unavailable')}
        />
        {retryReferenceSync ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void retryReferenceSync().then(
                () => {
                  setRetryReferenceSync(null);
                  setMediaUsages((current) =>
                    current.map((usage) =>
                      usage.assetId ? { ...usage, referenceStatus: 'synced' } : usage
                    )
                  );
                  setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') });
                },
                () =>
                  setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
              )
            }
          >
            {pt('actions.retryMediaReferences')}
          </Button>
        ) : null}
        <GenericItemsDetailTabs
          activeTab={activeTab}
          categoryOptions={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          contentId={contentId}
          labels={labels}
          onOpenMediaPicker={(pickerMode) =>
            pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
          }
          onTabChange={setActiveTab}
          pt={pt}
          mediaUsages={mediaUsages}
          onChangeMediaUsages={(usages) => {
            setMediaUsages(usages);
            setRequiresReferenceSync(
              (current) => current || usages.some((usage) => Boolean(usage.assetId))
            );
          }}
          canSelectMedia={canSelectMedia}
          canUploadMedia={canUploadMedia}
          onLoadAssetSnapshot={async (usage) => {
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
            const persistentUrl = resolveGenericItemsPersistentDeliveryUrl(delivery);
            if (!persistentUrl) throw new Error('asset_unavailable');
            return toContentMediaAssetSnapshot({
              persistentUrl,
              altText: detail.metadata.altText ?? '',
              caption: detail.metadata.description ?? detail.metadata.title ?? '',
              credit: detail.metadata.copyright ?? '',
              license: detail.metadata.license ?? '',
            });
          }}
        />
        <StudioConfirmDialog
          open={deleteDialogOpen}
          title={pt('actions.delete')}
          description={pt('actions.deleteConfirm')}
          confirmLabel={pt('actions.delete')}
          cancelLabel={pt('actions.back')}
          confirmDisabled={deleting}
          cancelDisabled={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteDialogOpen(false)}
        >
          {status?.kind === 'error' ? (
            <StudioFormSummary kind="error">{status.text}</StudioFormSummary>
          ) : null}
        </StudioConfirmDialog>
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
