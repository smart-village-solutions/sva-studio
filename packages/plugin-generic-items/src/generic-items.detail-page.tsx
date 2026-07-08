import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import {
  getHostMediaAsset,
  updateHostMediaAsset,
  uploadHostMediaFile,
  usePluginTranslation,
  type HostMediaAssetDetail,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioLoadingState,
  StudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerOverlayLabels,
  useStudioMediaPickerOverlay,
} from '@sva/studio-ui-react';
import React from 'react';

import { createDefaultGenericItemsDetailFormValues } from './generic-items.detail-form.js';
import {
  isSupportedUploadFile,
  mediaContentFromAsset,
  mediaContentSourceKey,
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
import { genericItemsDetailFormSchema, type GenericItemsDetailFormValues } from './generic-items.validation.js';

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

const createSummaryErrors = (errors: ReturnType<typeof useForm<GenericItemsDetailFormValues>>['formState']['errors']) => {
  const entries = [
    getFieldErrorMessage(errors.title) ? { field: 'generic-item-title', message: getFieldErrorMessage(errors.title) } : null,
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

const readDetailFileName = (asset: Pick<HostMediaAssetDetail, 'id' | 'storageKey'>): string => {
  const storageKeyParts = asset.storageKey.split('/');
  const fileName = storageKeyParts[storageKeyParts.length - 1]?.trim();
  return fileName && fileName.length > 0 ? fileName : asset.id;
};

const toGenericItemsMediaPickerSummary = (asset: Parameters<typeof readAssetTitle>[0]): StudioMediaPickerAssetSummary => ({
  id: asset.id,
  title: readAssetTitle(asset),
  fileName: readAssetFileName(asset),
  previewUrl: asset.previewUrl,
  mimeType: asset.mimeType,
  visibility: asset.visibility,
});

const toGenericItemsMediaPickerDetail = (
  asset: HostMediaAssetDetail,
  summary?: Parameters<typeof readAssetTitle>[0]
): GenericItemsMediaPickerAsset => {
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
  onSubmit,
  pt,
}: Readonly<{
  disableActions: boolean;
  deleting: boolean;
  mode: 'create' | 'edit';
  onDelete: () => Promise<void>;
  onSubmit: () => Promise<void>;
  pt: (key: string) => string;
}>) => (
  <div className="flex gap-2">
    <Button asChild variant="outline">
      <Link {...genericItemsListLink}>{pt('actions.back')}</Link>
    </Button>
    {mode === 'edit' ? (
      <Button type="button" variant="outline" disabled={disableActions || deleting} onClick={() => void onDelete()}>
        {pt('actions.delete')}
      </Button>
    ) : null}
    <Button type="button" disabled={disableActions} onClick={() => void onSubmit()}>
      {mode === 'create' ? pt('actions.create') : pt('actions.update')}
    </Button>
  </div>
);

export function GenericItemsDetailPage({
  mode,
  contentId,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
}>) {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const labels = React.useMemo(() => createGenericItemsDetailLabels(pt), [pt]);
  const mediaPickerLabels = React.useMemo(() => createGenericItemsMediaPickerLabels(pt), [pt]);
  const methods = useForm<GenericItemsDetailFormValues>({
    resolver: zodResolver(genericItemsDetailFormSchema),
    defaultValues: createDefaultGenericItemsDetailFormValues(),
  });
  const summaryErrors = React.useMemo(() => createSummaryErrors(methods.formState.errors), [methods.formState.errors]);
  const [status, setStatus] = React.useState<StatusMessage | null>(null);
  const { mediaAssets, refreshMediaAssets } = useGenericItemsMediaAssets();
  const { categoryOptions, categoryOptionsError, categoryOptionsLoading } = useGenericItemsCategoryOptions(pt);
  const loading = useGenericItemsDetailLoader({ contentId, methods, mode, pt, setStatus });
  const { activeTab, deleting, handleDelete, onSubmit, setActiveTab } = useGenericItemsDetailActions({
    contentId,
    methods,
    mode,
    navigate,
    pt,
    setStatus,
  });
  const isAssetSelectable = React.useCallback((asset: GenericItemsMediaPickerAsset) => {
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
  }, [methods]);

  const mediaPicker = useStudioMediaPickerOverlay<GenericItemsMediaPickerAsset>({
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
      return { assetId: uploaded.assetId };
    },
    loadAsset: async (assetId) => {
      const detail = await getHostMediaAsset({ fetch: globalThis.fetch.bind(globalThis), assetId });
      const summary = mediaAssets.find((asset) => asset.id === assetId);
      return toGenericItemsMediaPickerDetail(detail, summary);
    },
    saveAssetMetadata: async (assetId, metadata) => {
      const detail = await updateHostMediaAsset({
        fetch: globalThis.fetch.bind(globalThis),
        assetId,
        metadata,
        visibility: 'public',
      });
      await refreshMediaAssets();
      const summary = mediaAssets.find((asset) => asset.id === assetId);
      return toGenericItemsMediaPickerDetail(detail, summary);
    },
  });
  const mediaPickerFeedback = React.useMemo(
    () => resolveGenericItemsMediaPickerFeedback(pt, mediaPicker.errorCode, mediaPicker.uploadPhase),
    [mediaPicker.errorCode, mediaPicker.uploadPhase, pt]
  );

  if (loading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
        description={mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')}
        actions={
          <DetailPageActions
            disableActions={methods.formState.isSubmitting}
            deleting={deleting}
            mode={mode}
            onDelete={handleDelete}
            onSubmit={onSubmit}
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
        <StudioFormSummaryErrors errors={summaryErrors} />
        {status ? (
          <StudioFormSummary data-testid="generic-items-status" kind={status.kind}>
            {status.text}
          </StudioFormSummary>
        ) : null}
        <GenericItemsDetailTabs
          activeTab={activeTab}
          categoryOptions={categoryOptions}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
          onOpenMediaPicker={(pickerMode) =>
            pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
          }
          onTabChange={setActiveTab}
          pt={pt}
        />
      </StudioDetailPageTemplate>
    </FormProvider>
  );
}
