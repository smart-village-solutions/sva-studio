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

const useStudioMediaPickerOverlayStateActions = (input: Readonly<{
  close: () => void;
  openLibrary: () => void;
  openUpload: () => void;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  setUploadPhase: React.Dispatch<React.SetStateAction<StudioMediaPickerUploadPhase>>;
  setErrorCode: React.Dispatch<React.SetStateAction<StudioMediaPickerErrorCode | null>>;
  setReviewAsset: React.Dispatch<React.SetStateAction<StudioMediaPickerAssetDetail | null>>;
  setMetadataDraft: React.Dispatch<React.SetStateAction<StudioMediaPickerMetadataDraft>>;
  setIsLoadingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSavingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setMode: React.Dispatch<React.SetStateAction<StudioMediaPickerMode>>;
  setReviewSource: React.Dispatch<React.SetStateAction<StudioMediaPickerReviewSource>>;
}>) =>
  React.useMemo(
    () => ({ ...input }),
    [
      input.close,
      input.openLibrary,
      input.openUpload,
      input.setErrorCode,
      input.setIsLoadingReviewAsset,
      input.setIsSavingReviewAsset,
      input.setMetadataDraft,
      input.setMode,
      input.setReviewAsset,
      input.setReviewSource,
      input.setSearchValue,
      input.setUploadPhase,
    ]
  );

const useStudioMediaPickerOverlayLifecycle = (input: Readonly<{
  resetTransientState: () => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMode: React.Dispatch<React.SetStateAction<StudioMediaPickerMode>>;
  setReviewSource: React.Dispatch<React.SetStateAction<StudioMediaPickerReviewSource>>;
  setErrorCode: React.Dispatch<React.SetStateAction<StudioMediaPickerErrorCode | null>>;
  setUploadPhase: React.Dispatch<React.SetStateAction<StudioMediaPickerUploadPhase>>;
}>) => {
  const { resetTransientState, setErrorCode, setMode, setOpen, setReviewSource, setUploadPhase } = input;
  const close = React.useCallback(() => {
    setOpen(false);
    setMode('library');
    setReviewSource('library');
    resetTransientState();
  }, [resetTransientState, setMode, setOpen, setReviewSource]);
  const openLibrary = React.useCallback(() => {
    setOpen(true);
    setMode('library');
    setReviewSource('library');
    setErrorCode(null);
    setUploadPhase('idle');
  }, [setErrorCode, setMode, setOpen, setReviewSource, setUploadPhase]);
  const openUpload = React.useCallback(() => {
    setOpen(true);
    setMode('upload');
    setReviewSource('upload');
    setErrorCode(null);
    setUploadPhase('idle');
  }, [setErrorCode, setMode, setOpen, setReviewSource, setUploadPhase]);

  return { close, openLibrary, openUpload } as const;
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

  const { close, openLibrary, openUpload } = useStudioMediaPickerOverlayLifecycle({
    resetTransientState,
    setErrorCode,
    setMode,
    setOpen,
    setReviewSource,
    setUploadPhase,
  });

  const actions = useStudioMediaPickerOverlayStateActions({
    close,
    openLibrary,
    openUpload,
    setErrorCode,
    setIsLoadingReviewAsset,
    setIsSavingReviewAsset,
    setMetadataDraft,
    setMode,
    setReviewAsset,
    setReviewSource,
    setSearchValue,
    setUploadPhase,
  });

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
