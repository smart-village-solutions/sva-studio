import React from 'react';

import type { StudioMediaPickerAssetDetail, StudioMediaPickerMetadataDraft } from './studio-media-picker-overlay.shared.js';
import {
  useStudioMediaPickerOverlayLifecycle,
  useStudioMediaPickerOverlayReviewActions,
  useStudioMediaPickerOverlayState,
  useStudioMediaPickerOverlaySubmissionActions,
} from './use-studio-media-picker-overlay.helpers.js';

type UseStudioMediaPickerOverlayOptions<TAssetDetail extends StudioMediaPickerAssetDetail> = Readonly<{
  onAccept: (asset: TAssetDetail) => void;
  isSupportedUploadFile: (file: File) => boolean;
  uploadAsset: (file: File) => Promise<{ readonly assetId: string }>;
  loadAsset: (assetId: string) => Promise<TAssetDetail>;
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataDraft) => Promise<TAssetDetail>;
  canAcceptAsset?: (asset: TAssetDetail) => boolean;
}>;

export const useStudioMediaPickerOverlay = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  isSupportedUploadFile,
  loadAsset,
  onAccept,
  saveAssetMetadata,
  uploadAsset,
}: UseStudioMediaPickerOverlayOptions<TAssetDetail>) => {
  const state = useStudioMediaPickerOverlayState<TAssetDetail>();
  const {
    close,
    openLibrary,
    openUpload,
  } = useStudioMediaPickerOverlayLifecycle({
    setErrorCode: state.setErrorCode,
    setIsLoadingReviewAsset: state.setIsLoadingReviewAsset,
    setIsSavingReviewAsset: state.setIsSavingReviewAsset,
    setMetadataDraft: state.setMetadataDraft,
    setMode: state.setMode,
    setOpen: state.setOpen,
    setReviewAsset: state.setReviewAsset as React.Dispatch<React.SetStateAction<StudioMediaPickerAssetDetail | null>>,
    setReviewSource: state.setReviewSource,
    setSearchValue: state.setSearchValue,
    setUploadPhase: state.setUploadPhase,
  });
  const { goBackFromReview, loadReviewAsset, selectAsset, updateMetadataField } =
    useStudioMediaPickerOverlayReviewActions<TAssetDetail>({
      loadAsset,
      reviewSource: state.reviewSource,
      setErrorCode: state.setErrorCode,
      setIsLoadingReviewAsset: state.setIsLoadingReviewAsset,
      setMetadataDraft: state.setMetadataDraft,
      setMode: state.setMode,
      setReviewAsset: state.setReviewAsset,
      setReviewSource: state.setReviewSource,
    });
  const { confirmSelection, uploadFile } = useStudioMediaPickerOverlaySubmissionActions<TAssetDetail>({
    canAcceptAsset,
    close,
    isSupportedUploadFile,
    loadReviewAsset,
    metadataDraft: state.metadataDraft,
    onAccept,
    reviewAsset: state.reviewAsset,
    saveAssetMetadata,
    setErrorCode: state.setErrorCode,
    setIsSavingReviewAsset: state.setIsSavingReviewAsset,
    setReviewAsset: state.setReviewAsset,
    setMetadataDraft: state.setMetadataDraft,
    setUploadPhase: state.setUploadPhase,
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
    reviewAsset: state.reviewAsset,
    metadataDraft: state.metadataDraft,
    isLoadingReviewAsset: state.isLoadingReviewAsset,
    isSavingReviewAsset: state.isSavingReviewAsset,
    close,
    openLibrary,
    openUpload,
    selectAsset,
    uploadFile,
    updateMetadataField,
    goBackFromReview,
    confirmSelection,
  } as const;
};
