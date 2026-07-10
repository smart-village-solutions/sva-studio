import React from 'react';

import {
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMode,
  type StudioMediaPickerReviewSource,
  type StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.shared.js';

export const emptyMetadataDraft: StudioMediaPickerMetadataDraft = {
  title: '',
  altText: '',
  description: '',
  copyright: '',
  license: '',
};

export const useStudioMediaPickerOverlayState = () => {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<StudioMediaPickerMode>('library');
  const [reviewSource, setReviewSource] = React.useState<StudioMediaPickerReviewSource>('library');
  const [searchValue, setSearchValue] = React.useState('');
  const [uploadPhase, setUploadPhase] = React.useState<StudioMediaPickerUploadPhase>('idle');
  const [errorCode, setErrorCode] = React.useState<StudioMediaPickerErrorCode | null>(null);
  const [reviewAsset, setReviewAsset] = React.useState<StudioMediaPickerAssetDetail | null>(null);
  const [metadataDraft, setMetadataDraft] = React.useState<StudioMediaPickerMetadataDraft>(emptyMetadataDraft);
  const [isLoadingReviewAsset, setIsLoadingReviewAsset] = React.useState(false);
  const [isSavingReviewAsset, setIsSavingReviewAsset] = React.useState(false);

  const resetTransientState = React.useCallback(() => {
    setSearchValue('');
    setUploadPhase('idle');
    setErrorCode(null);
    setReviewAsset(null);
    setMetadataDraft(emptyMetadataDraft);
    setIsLoadingReviewAsset(false);
    setIsSavingReviewAsset(false);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setMode('library');
    setReviewSource('library');
    resetTransientState();
  }, [resetTransientState]);

  const openLibrary = React.useCallback(() => {
    setOpen(true);
    setMode('library');
    setReviewSource('library');
    setErrorCode(null);
    setUploadPhase('idle');
  }, []);

  const openUpload = React.useCallback(() => {
    setOpen(true);
    setMode('upload');
    setReviewSource('upload');
    setErrorCode(null);
    setUploadPhase('idle');
  }, []);

  const actions = React.useMemo(
    () => ({
      setSearchValue,
      setUploadPhase,
      setErrorCode,
      setReviewAsset,
      setMetadataDraft,
      setIsLoadingReviewAsset,
      setIsSavingReviewAsset,
      close,
      openLibrary,
      openUpload,
      setMode,
      setReviewSource,
    }),
    [close, openLibrary, openUpload]
  );

  return {
    open,
    mode,
    reviewSource,
    searchValue,
    setSearchValue,
    uploadPhase,
    setUploadPhase,
    errorCode,
    setErrorCode,
    reviewAsset,
    setReviewAsset,
    metadataDraft,
    setMetadataDraft,
    isLoadingReviewAsset,
    setIsLoadingReviewAsset,
    isSavingReviewAsset,
    setIsSavingReviewAsset,
    close,
    openLibrary,
    openUpload,
    setMode,
    setReviewSource,
    actions,
  } as const;
};
