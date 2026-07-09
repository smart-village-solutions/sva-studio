import React from 'react';

import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerReviewSource,
} from './studio-media-picker-overlay.shared.js';
import { useStudioMediaPickerOverlayState } from './use-studio-media-picker-overlay.state.js';

export type StudioMediaPickerUploadAssetResult = Readonly<{
  assetId: string;
  previewUrl?: string | null;
}>;

export type StudioMediaPickerOverlayOptions<TAssetDetail extends StudioMediaPickerAssetDetail> = Readonly<{
  onAccept: (asset: TAssetDetail) => void;
  isSupportedUploadFile: (file: File) => boolean;
  uploadAsset: (file: File) => Promise<StudioMediaPickerUploadAssetResult>;
  loadAsset: (assetId: string) => Promise<TAssetDetail>;
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataDraft) => Promise<TAssetDetail>;
  canAcceptAsset?: (asset: TAssetDetail) => boolean;
}>;

export const withPreviewUrlFallback = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  asset: TAssetDetail,
  previewUrlFallback?: string | null
): TAssetDetail => {
  if (asset.previewUrl && asset.previewUrl.trim().length > 0) {
    return asset;
  }
  if (!previewUrlFallback || previewUrlFallback.trim().length === 0) {
    return asset;
  }

  return {
    ...asset,
    previewUrl: previewUrlFallback,
  };
};

const useReviewAssetLoader = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  loadAsset: (assetId: string) => Promise<TAssetDetail>
) =>
  React.useCallback(
    async (assetId: string, source: StudioMediaPickerReviewSource, previewUrlFallback?: string | null) => {
      state.setIsLoadingReviewAsset(true);
      state.setErrorCode(null);
      try {
        const asset = withPreviewUrlFallback(await loadAsset(assetId), previewUrlFallback);
        state.setReviewAsset(asset);
        state.setMetadataDraft(createMetadataDraft(asset));
        state.setReviewSource(source);
        state.setMode('review');
      } catch {
        state.setErrorCode('asset_load_failed');
      } finally {
        state.setIsLoadingReviewAsset(false);
      }
    },
    [loadAsset, state]
  );

const useUploadFileAction = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  isSupportedUploadFile: (file: File) => boolean,
  uploadAsset: (file: File) => Promise<StudioMediaPickerUploadAssetResult>,
  loadReviewAsset: (assetId: string, source: StudioMediaPickerReviewSource, previewUrlFallback?: string | null) => Promise<void>
) =>
  React.useCallback(
    async (file: File) => {
      if (!isSupportedUploadFile(file)) {
        state.setErrorCode('unsupported_upload_type');
        state.setUploadPhase('error');
        return;
      }

      state.setUploadPhase('initializing');
      state.setErrorCode(null);

      try {
        state.setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        state.setUploadPhase('finalizing');
        await loadReviewAsset(uploaded.assetId, 'upload', uploaded.previewUrl);
        state.setUploadPhase('success');
      } catch {
        state.setUploadPhase('error');
        state.setErrorCode('upload_failed');
      }
    },
    [isSupportedUploadFile, loadReviewAsset, state, uploadAsset]
  );

const useConfirmSelectionAction = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  reviewAsset: TAssetDetail | null,
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataDraft) => Promise<TAssetDetail>,
  onAccept: (asset: TAssetDetail) => void,
  canAcceptAsset?: (asset: TAssetDetail) => boolean
) =>
  React.useCallback(async () => {
    if (!reviewAsset) {
      return;
    }

    state.setIsSavingReviewAsset(true);
    state.setErrorCode(null);

    try {
      const updatedAsset = withPreviewUrlFallback(
        await saveAssetMetadata(reviewAsset.id, state.metadataDraft),
        reviewAsset.previewUrl
      );
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        state.setReviewAsset(updatedAsset);
        state.setMetadataDraft(createMetadataDraft(updatedAsset));
        state.setErrorCode('asset_unavailable');
        return;
      }
      state.setReviewAsset(updatedAsset);
      state.setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      state.close();
    } catch {
      state.setErrorCode('metadata_save_failed');
    } finally {
      state.setIsSavingReviewAsset(false);
    }
  }, [canAcceptAsset, onAccept, reviewAsset, saveAssetMetadata, state]);

export const useStudioMediaPickerOverlayActions = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  options: StudioMediaPickerOverlayOptions<TAssetDetail>
) => {
  const { canAcceptAsset, isSupportedUploadFile, loadAsset, onAccept, saveAssetMetadata, uploadAsset } = options;
  const reviewAsset = state.reviewAsset as TAssetDetail | null;
  const loadReviewAsset = useReviewAssetLoader(state, loadAsset);

  const selectAsset = React.useCallback(
    async (asset: StudioMediaPickerAssetSummary) => {
      await loadReviewAsset(asset.id, 'library');
    },
    [loadReviewAsset]
  );

  const uploadFile = useUploadFileAction(state, isSupportedUploadFile, uploadAsset, loadReviewAsset);

  const updateMetadataField = React.useCallback(
    <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => {
      state.setMetadataDraft((current) => ({
        ...current,
        [key]: value,
      }));
      state.setErrorCode(null);
    },
    [state]
  );

  const goBackFromReview = React.useCallback(() => {
    state.setMode(state.reviewSource);
    state.setErrorCode(null);
  }, [state]);

  const confirmSelection = useConfirmSelectionAction(
    state,
    reviewAsset,
    saveAssetMetadata,
    onAccept,
    canAcceptAsset
  );

  return {
    selectAsset,
    uploadFile,
    updateMetadataField,
    goBackFromReview,
    confirmSelection,
  } as const;
};
