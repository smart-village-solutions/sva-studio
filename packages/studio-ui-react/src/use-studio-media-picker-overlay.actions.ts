import * as React from 'react';

import { revokeBrowserObjectUrl } from './content-media-usage.js';
import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
  type StudioMediaPickerReviewSource,
} from './studio-media-picker-overlay.shared.js';
import {
  useConfirmSelectionAction,
  withPreviewUrlFallback,
  type StudioMediaPickerMetadataUpdate,
} from './use-studio-media-picker-overlay.confirm.js';
import { useStudioMediaPickerOverlayState } from './use-studio-media-picker-overlay.state.js';

export type StudioMediaPickerUploadAssetResult = Readonly<{
  assetId: string;
  previewUrl?: string | null;
}>;

export type StudioMediaPickerOverlayOptions<TAssetDetail extends StudioMediaPickerAssetDetail> =
  Readonly<{
    onAccept: (asset: TAssetDetail) => void;
    isSupportedUploadFile: (file: File) => boolean;
    uploadAsset?: (file: File) => Promise<StudioMediaPickerUploadAssetResult>;
    createLocalAsset?: (input: {
      readonly file: File;
      readonly draftId: string;
      readonly previewUrl: string;
    }) => TAssetDetail;
    loadAsset: (assetId: string) => Promise<TAssetDetail>;
    saveAssetMetadata: (
      assetId: string,
      metadata: StudioMediaPickerMetadataUpdate
    ) => Promise<TAssetDetail>;
    canAcceptAsset?: (asset: TAssetDetail) => boolean;
    editableMetadataFields?: readonly StudioMediaPickerMetadataField[];
  }>;

const useReviewAssetLoader = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  loadAsset: (assetId: string) => Promise<TAssetDetail>
) => {
  const requestId = React.useRef(0);
  const { actions } = state;

  return React.useCallback(
    async (
      assetId: string,
      source: StudioMediaPickerReviewSource,
      previewUrlFallback?: string | null
    ) => {
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
  uploadAsset: ((file: File) => Promise<StudioMediaPickerUploadAssetResult>) | undefined,
  createLocalAsset: StudioMediaPickerOverlayOptions<StudioMediaPickerAssetDetail>['createLocalAsset'],
  loadReviewAsset: (
    assetId: string,
    source: StudioMediaPickerReviewSource,
    previewUrlFallback?: string | null
  ) => Promise<boolean>
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
        if (createLocalAsset) {
          if (state.reviewAsset?.localDraft) {
            revokeBrowserObjectUrl(state.reviewAsset.previewUrl);
          }
          const previewUrl = URL.createObjectURL(file);
          const localAsset = createLocalAsset({
            file,
            draftId: globalThis.crypto.randomUUID(),
            previewUrl,
          });
          actions.setReviewAsset(localAsset);
          actions.setMetadataDraft(createMetadataDraft(localAsset));
          actions.setReviewSource('upload');
          actions.setMode('review');
          actions.setUploadPhase('success');
          return;
        }
        if (!uploadAsset) {
          throw new TypeError('No media upload strategy configured.');
        }
        actions.setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        actions.setUploadPhase('finalizing');
        const didLoadReviewAsset = await loadReviewAsset(
          uploaded.assetId,
          'upload',
          uploaded.previewUrl
        );
        actions.setUploadPhase(didLoadReviewAsset ? 'success' : 'error');
      } catch {
        actions.setUploadPhase('error');
        actions.setErrorCode('upload_failed');
      }
    },
    [
      actions,
      createLocalAsset,
      isSupportedUploadFile,
      loadReviewAsset,
      state.reviewAsset,
      uploadAsset,
    ]
  );
};

export const useStudioMediaPickerOverlayActions = <
  TAssetDetail extends StudioMediaPickerAssetDetail,
>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  options: StudioMediaPickerOverlayOptions<TAssetDetail>
) => {
  const {
    canAcceptAsset,
    createLocalAsset,
    editableMetadataFields,
    isSupportedUploadFile,
    loadAsset,
    onAccept,
    saveAssetMetadata,
    uploadAsset,
  } = options;
  const { actions } = state;
  const reviewAsset = state.reviewAsset as TAssetDetail | null;
  const loadReviewAsset = useReviewAssetLoader(state, loadAsset);

  const selectAsset = React.useCallback(
    async (asset: StudioMediaPickerAssetSummary) => {
      await loadReviewAsset(asset.id, 'library');
    },
    [loadReviewAsset]
  );

  const uploadFile = useUploadFileAction(
    state,
    isSupportedUploadFile,
    uploadAsset,
    createLocalAsset,
    loadReviewAsset
  );

  const updateMetadataField = React.useCallback(
    <Key extends keyof StudioMediaPickerMetadataDraft>(
      key: Key,
      value: StudioMediaPickerMetadataDraft[Key]
    ) => {
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
    canAcceptAsset,
    editableMetadataFields
  );

  return {
    selectAsset,
    uploadFile,
    updateMetadataField,
    goBackFromReview,
    confirmSelection,
  } as const;
};
