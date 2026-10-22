import * as React from 'react';

import { revokeBrowserObjectUrl } from './content-media-usage.js';
import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
} from './studio-media-picker-overlay.shared.js';
import {
  type StudioMediaPickerOverlayOptions,
  useStudioMediaPickerOverlayActions,
} from './use-studio-media-picker-overlay.actions.js';
import { useStudioMediaPickerOverlayState } from './use-studio-media-picker-overlay.state.js';

export const useStudioMediaPickerOverlay = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  createLocalAsset,
  editableMetadataFields,
  isSupportedUploadFile,
  loadAsset,
  onAccept,
  saveAssetMetadata,
  uploadAsset,
}: StudioMediaPickerOverlayOptions<TAssetDetail>) => {
  const state = useStudioMediaPickerOverlayState();
  const actions = useStudioMediaPickerOverlayActions<TAssetDetail>(state, {
    canAcceptAsset,
    createLocalAsset,
    editableMetadataFields,
    isSupportedUploadFile,
    loadAsset,
    onAccept,
    saveAssetMetadata,
    uploadAsset,
  });
  const reviewAssetRef = React.useRef(state.reviewAsset);
  reviewAssetRef.current = state.reviewAsset;
  React.useEffect(
    () => () => {
      const reviewAsset = reviewAssetRef.current;
      if (reviewAsset?.localDraft) revokeBrowserObjectUrl(reviewAsset.previewUrl);
    },
    []
  );
  const close = React.useCallback(() => {
    if (state.reviewAsset?.localDraft) revokeBrowserObjectUrl(state.reviewAsset.previewUrl);
    state.close();
  }, [state.close, state.reviewAsset]);

  const openAsset = React.useCallback(
    (asset: TAssetDetail) => {
      state.openLibrary();
      state.actions.setReviewAsset(asset);
      state.actions.setMetadataDraft(createMetadataDraft(asset));
      state.actions.setMode('review');
    },
    [state.openLibrary, state.actions]
  );

  return {
    open: state.open,
    openAsset,
    canConfirmSelection: Boolean(
      state.reviewAsset && (!canAcceptAsset || canAcceptAsset(state.reviewAsset as TAssetDetail))
    ),
    mode: state.mode,
    reviewSource: state.reviewSource,
    searchValue: state.searchValue,
    setSearchValue: state.setSearchValue,
    uploadPhase: state.uploadPhase,
    errorCode: state.errorCode,
    reviewAsset: state.reviewAsset as TAssetDetail | null,
    metadataDraft: state.metadataDraft,
    isLoadingReviewAsset: state.isLoadingReviewAsset,
    isSavingReviewAsset: state.isSavingReviewAsset,
    close,
    openLibrary: state.openLibrary,
    openUpload: state.openUpload,
    selectAsset: actions.selectAsset,
    uploadFile: actions.uploadFile,
    updateMetadataField: actions.updateMetadataField,
    goBackFromReview: actions.goBackFromReview,
    confirmSelection: actions.confirmSelection,
    saveCentralMetadata: actions.saveCentralMetadata,
    applyImageEdit: actions.applyImageEdit,
    updateImageFocus: actions.updateImageFocus,
  } as const;
};
