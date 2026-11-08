import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  getHostMediaAsset,
  uploadHostMediaFile,
  updateHostMediaAsset,
  isSupportedContentMediaUploadFile,
  resolveContentMediaCapabilities,
  type HostMediaUploadCheckpoint,
  getHostMediaDelivery,
  listHostMediaAssets,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  getHostMediaAssetFileName,
  usePluginTranslation,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';
import {
  createLocalStudioMediaPickerAsset,
  isPersistableContentMediaUrl,
  revokeBrowserObjectUrl,
  resolveStudioMediaPickerFeedback,
  createStudioMediaPickerLabels,
  StudioMediaPickerOverlay,
  useStudioMediaPickerOverlay,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import { useConstructionSiteAccess } from './construction-sites.access.js';
import type { ConstructionSiteInput } from './contract.js';
type Media = ConstructionSiteInput['mediaContents'][number];
const isConstructionSiteAssetSelectable = (
  asset: StudioMediaPickerAssetDetail,
  capabilities: ReturnType<typeof resolveContentMediaCapabilities>
) =>
  capabilities.canSelect &&
  Boolean(
    asset.localDraft
      ? capabilities.canUpload
      : asset.visibility === 'public' &&
          asset.persistentUrl &&
          isPersistableContentMediaUrl(asset.persistentUrl)
  );

async function acceptConstructionSiteMediaAsset(
  asset: StudioMediaPickerAssetDetail,
  onSelect: (media: Media) => void,
  canUpload: boolean,
  checkpoint: RefObject<{ draftId: string; upload: HostMediaUploadCheckpoint } | null>,
  onInitialize: (draftId: string) => void,
  refresh: () => Promise<readonly HostMediaAssetListItem[]>
) {
  let selected = asset;
  if (asset.localDraft) {
    if (!canUpload) throw new Error('media_upload_forbidden');
    const draft = asset.localDraft;
    const uploaded = await uploadHostMediaFile({
      fetch,
      file: draft.file,
      visibility: 'public',
      mediaType: 'image',
      editing: draft.editing,
      metadata: {
        ...draft.metadata,
        ...asset.metadata,
        tags: asset.metadata.tags ? [...asset.metadata.tags] : undefined,
      },
      checkpoint: checkpoint.current?.draftId === draft.id ? checkpoint.current.upload : undefined,
      onCheckpoint: (upload) => {
        checkpoint.current = { draftId: draft.id, upload };
        onInitialize(draft.id);
      },
    });
    selected = await loadConstructionSiteAsset(uploaded.assetId);
    await refresh();
  }
  if (!selected.persistentUrl || !isPersistableContentMediaUrl(selected.persistentUrl))
    throw new Error('media_delivery_unavailable');
  onSelect({
    contentType: selected.mimeType?.startsWith('audio/')
      ? 'audio'
      : selected.mimeType?.startsWith('video/')
        ? 'video'
        : selected.mimeType?.startsWith('image/')
          ? 'image'
          : 'attachement',
    hostMediaAssetId: selected.id,
    sourceUrl: { url: selected.persistentUrl, description: asset.metadata.altText ?? '' },
    captionText: asset.metadata.description ?? '',
    copyright: asset.metadata.copyright ?? '',
  });
  if (asset.localDraft) revokeBrowserObjectUrl(asset.previewUrl);
}

export function useConstructionSiteMediaPicker(
  onSelect: (media: Media) => void,
  canEditContent = true
) {
  const access = useConstructionSiteAccess();
  const capabilities = resolveContentMediaCapabilities({
    canEditContent,
    permissionActions: access.permissionActions,
  });
  const [assets, setAssets] = useState<readonly HostMediaAssetListItem[]>([]);
  const assetsRef = useRef<readonly HostMediaAssetListItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const checkpoint = useRef<{ draftId: string; upload: HostMediaUploadCheckpoint } | null>(null);
  const [initializedDraftId, setInitializedDraftId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await listHostMediaAssets({ fetch, visibility: 'public' });
      assetsRef.current = result;
      setAssets(result);
      return result;
    } catch {
      setError(true);
      return assetsRef.current;
    } finally {
      setLoading(false);
    }
  }, []);
  const picker = useStudioMediaPickerOverlay({
    loadAsset: loadConstructionSiteAsset,
    saveAssetMetadata: async (assetId, metadata) => {
      await updateHostMediaAsset({ fetch, assetId, metadata });
      await refresh();
      return loadConstructionSiteAsset(assetId);
    },
    isSupportedUploadFile: isSupportedContentMediaUploadFile,
    createLocalAsset: createLocalStudioMediaPickerAsset,
    editableMetadataFields: ['altText', 'description', 'copyright'],
    persistenceContext: 'content',
    canAcceptAsset: (asset) => isConstructionSiteAssetSelectable(asset, capabilities),
    onAccept: (asset) =>
      acceptConstructionSiteMediaAsset(
        asset,
        onSelect,
        capabilities.canUpload,
        checkpoint,
        setInitializedDraftId,
        refresh
      ),
  });
  useEffect(() => {
    if (picker.open && capabilities.canSelect) void refresh();
  }, [picker.open, capabilities.canSelect, refresh]);
  return {
    assets,
    picker,
    capabilities,
    libraryStatus: { loading, error, onRetry: refresh },
    isUploadInitialized:
      initializedDraftId !== null && initializedDraftId === picker.reviewAsset?.localDraft?.id,
  };
}
const loadConstructionSiteAsset = async (
  assetId: string
): Promise<StudioMediaPickerAssetDetail> => {
  const [asset, delivery] = await Promise.all([
    getHostMediaAsset({ fetch, assetId }),
    getHostMediaDelivery({ fetch, assetId }),
  ]);
  return {
    id: asset.id,
    instanceId: asset.instanceId,
    hasEditingDocument: asset.hasEditingDocument,
    fileName: getHostMediaAssetFileName(asset),
    title: asset.metadata.title ?? '',
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    previewUrl: asset.previewUrl ?? null,
    persistentUrl: delivery.isPublicUrl ? delivery.deliveryUrl : null,
    metadata: {
      title: asset.metadata.title ?? '',
      altText: asset.metadata.altText ?? '',
      description: asset.metadata.description ?? '',
      copyright: asset.metadata.copyright ?? '',
      license: asset.metadata.license ?? '',
      tags: asset.metadata.tags,
    },
  };
};
export function ConstructionSiteMediaOverlay({
  media,
  onAddManual,
}: Readonly<{
  media: ReturnType<typeof useConstructionSiteMediaPicker>;
  onAddManual: () => string;
}>) {
  const { assets, picker, capabilities } = media;
  const pt = usePluginTranslation('construction-sites');
  return (
    <StudioMediaPickerOverlay
      libraryStatus={media.libraryStatus}
      open={picker.open}
      mode={picker.mode}
      reviewSource={picker.reviewSource}
      assets={assets.map((asset) => ({
        id: asset.id,
        fileName: readHostMediaAssetFileName(asset),
        title: readHostMediaAssetTitle(asset),
        mimeType: asset.mimeType,
        visibility: asset.visibility,
        previewUrl: asset.previewUrl ?? null,
      }))}
      searchValue={picker.searchValue}
      onSearchValueChange={(value) => {
        picker.setSearchValue(value);
      }}
      onClose={picker.close}
      onChangeMode={(mode) => (mode === 'upload' ? picker.openUpload() : picker.openLibrary())}
      onAddManual={onAddManual}
      onSelectAsset={(asset) => void picker.selectAsset(asset)}
      uploadPhase={picker.uploadPhase}
      onUploadFile={picker.uploadFile}
      reviewAsset={picker.reviewAsset}
      metadataDraft={picker.metadataDraft}
      onMetadataChange={picker.updateMetadataField}
      onBackFromReview={picker.goBackFromReview}
      onConfirmSelection={() => void picker.confirmSelection()}
      isLoadingReviewAsset={picker.isLoadingReviewAsset}
      isSavingReviewAsset={picker.isSavingReviewAsset}
      isUploadInitialized={media.isUploadInitialized}
      canConfirmSelection={picker.canConfirmSelection}
      isMetadataEditable
      visibleMetadataFields={['altText', 'description', 'copyright']}
      persistenceContext="content"
      canEditCentralMetadata={capabilities.canEditAssetMetadata}
      onSaveCentralMetadata={picker.saveCentralMetadata}
      onApplyImageEdit={capabilities.canUpload ? picker.applyImageEdit : undefined}
      onImageFocusChange={picker.updateImageFocus}
      canUpload={capabilities.canUpload}
      feedbackMessage={
        resolveStudioMediaPickerFeedback(pt, picker.errorCode, picker.uploadPhase).message
      }
      feedbackTone={resolveStudioMediaPickerFeedback(pt, picker.errorCode, picker.uploadPhase).tone}
      labels={createStudioMediaPickerLabels(pt)}
    />
  );
}
