import * as React from 'react';

import {
  createMetadataDraft,
  metadataDraftsMatch,
  toMetadataUpdate,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataUpdate,
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
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataUpdate) => Promise<TAssetDetail>;
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
) => {
  const requestId = React.useRef(0);
  const { actions } = state;

  return React.useCallback(
    async (assetId: string, source: StudioMediaPickerReviewSource, previewUrlFallback?: string | null) => {
      const currentRequestId = ++requestId.current;
      actions.setIsLoadingReviewAsset(true);
      actions.setErrorCode(null);
      try {
        const asset = withPreviewUrlFallback(await loadAsset(assetId), previewUrlFallback);
        if (currentRequestId !== requestId.current) {
          return false;
        }
        actions.setReviewAsset(asset);
        actions.setMetadataDraft(createMetadataDraft(asset));
        actions.setReviewSource(source);
        actions.setMode('review');
        return true;
      } catch {
        if (currentRequestId !== requestId.current) {
          return false;
        }
        actions.setReviewAsset(null);
        actions.setErrorCode('asset_load_failed');
        actions.setMode('review');
        return false;
      } finally {
        if (currentRequestId === requestId.current) {
          actions.setIsLoadingReviewAsset(false);
        }
      }
    },
    [actions, loadAsset]
  );
};

const useUploadFileAction = (
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  isSupportedUploadFile: (file: File) => boolean,
  uploadAsset: (file: File) => Promise<StudioMediaPickerUploadAssetResult>,
  loadReviewAsset: (assetId: string, source: StudioMediaPickerReviewSource, previewUrlFallback?: string | null) => Promise<boolean>
) => {
  const { actions } = state;

  return React.useCallback(
    async (file: File) => {
      if (!isSupportedUploadFile(file)) {
        actions.setErrorCode('unsupported_upload_type');
        actions.setUploadPhase('error');
        return;
      }

      actions.setUploadPhase('initializing');
      actions.setErrorCode(null);

      try {
        actions.setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        actions.setUploadPhase('finalizing');
        const didLoadReviewAsset = await loadReviewAsset(uploaded.assetId, 'upload', uploaded.previewUrl);
        actions.setUploadPhase(didLoadReviewAsset ? 'success' : 'error');
      } catch {
        actions.setUploadPhase('error');
        actions.setErrorCode('upload_failed');
      }
    },
    [actions, isSupportedUploadFile, loadReviewAsset, uploadAsset]
  );
};

const useConfirmSelectionAction = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  reviewAsset: TAssetDetail | null,
  metadataDraft: StudioMediaPickerMetadataDraft,
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataUpdate) => Promise<TAssetDetail>,
  onAccept: (asset: TAssetDetail) => void,
  canAcceptAsset?: (asset: TAssetDetail) => boolean
) => {
  const { actions } = state;

  return React.useCallback(async () => {
    if (!reviewAsset) {
      return;
    }

    actions.setErrorCode(null);

    if (canAcceptAsset && !canAcceptAsset(reviewAsset)) {
      actions.setErrorCode('asset_unavailable');
      return;
    }

    if (metadataDraftsMatch(metadataDraft, createMetadataDraft(reviewAsset))) {
      onAccept(reviewAsset);
      actions.close();
      return;
    }

    actions.setIsSavingReviewAsset(true);

    try {
      const updatedAsset = withPreviewUrlFallback(
        await saveAssetMetadata(reviewAsset.id, toMetadataUpdate(metadataDraft)),
        reviewAsset.previewUrl
      );
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        actions.setReviewAsset(updatedAsset);
        actions.setMetadataDraft(createMetadataDraft(updatedAsset));
        actions.setErrorCode('asset_unavailable');
        return;
      }
      actions.setReviewAsset(updatedAsset);
      actions.setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      actions.close();
    } catch {
      actions.setErrorCode('metadata_save_failed');
    } finally {
      actions.setIsSavingReviewAsset(false);
    }
  }, [actions, canAcceptAsset, metadataDraft, onAccept, reviewAsset, saveAssetMetadata]);
};

export const useStudioMediaPickerOverlayActions = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  options: StudioMediaPickerOverlayOptions<TAssetDetail>
) => {
  const { canAcceptAsset, isSupportedUploadFile, loadAsset, onAccept, saveAssetMetadata, uploadAsset } = options;
  const { actions } = state;
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
      actions.setMetadataDraft((current) => ({
        ...current,
        [key]: value,
      }));
      actions.setErrorCode(null);
    },
    [actions]
  );

  const goBackFromReview = React.useCallback(() => {
    actions.setMode(state.reviewSource);
    actions.setErrorCode(null);
  }, [actions, state.reviewSource]);

  const confirmSelection = useConfirmSelectionAction(
    state,
    reviewAsset,
    state.metadataDraft,
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
