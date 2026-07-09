import React from 'react';

import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';
import {
  type StudioMediaPickerOverlayOptions,
  useStudioMediaPickerOverlayActions,
} from './use-studio-media-picker-overlay.actions.js';
import { useStudioMediaPickerOverlayState } from './use-studio-media-picker-overlay.state.js';

export const useStudioMediaPickerOverlay = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  isSupportedUploadFile,
  loadAsset,
  onAccept,
  saveAssetMetadata,
  uploadAsset,
}: StudioMediaPickerOverlayOptions<TAssetDetail>) => {
  const state = useStudioMediaPickerOverlayState();
  const actions = useStudioMediaPickerOverlayActions<TAssetDetail>(state, {
    canAcceptAsset,
    isSupportedUploadFile,
    loadAsset,
    onAccept,
    saveAssetMetadata,
    uploadAsset,
  });

  return {
    open: state.open,
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
    close: state.close,
    openLibrary: state.openLibrary,
    openUpload: state.openUpload,
    selectAsset: actions.selectAsset,
    uploadFile: actions.uploadFile,
    updateMetadataField: actions.updateMetadataField,
    goBackFromReview: actions.goBackFromReview,
    confirmSelection: actions.confirmSelection,
  } as const;
};
