import React from 'react';

import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerAssetSummary,
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

export const useStudioMediaPickerOverlayState = <TAssetDetail extends StudioMediaPickerAssetDetail>() => {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<StudioMediaPickerMode>('library');
  const [reviewSource, setReviewSource] = React.useState<StudioMediaPickerReviewSource>('library');
  const [searchValue, setSearchValue] = React.useState('');
  const [uploadPhase, setUploadPhase] = React.useState<StudioMediaPickerUploadPhase>('idle');
  const [errorCode, setErrorCode] = React.useState<StudioMediaPickerErrorCode | null>(null);
  const [reviewAsset, setReviewAsset] = React.useState<TAssetDetail | null>(null);
  const [metadataDraft, setMetadataDraft] = React.useState<StudioMediaPickerMetadataDraft>(emptyMetadataDraft);
  const [isLoadingReviewAsset, setIsLoadingReviewAsset] = React.useState(false);
  const [isSavingReviewAsset, setIsSavingReviewAsset] = React.useState(false);

  return {
    open,
    setOpen,
    mode,
    setMode,
    reviewSource,
    setReviewSource,
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
  } as const;
};

export const useStudioMediaPickerOverlayLifecycle = ({
  setErrorCode,
  setIsLoadingReviewAsset,
  setIsSavingReviewAsset,
  setMetadataDraft,
  setMode,
  setOpen,
  setReviewAsset,
  setReviewSource,
  setSearchValue,
  setUploadPhase,
}: Readonly<{
  setErrorCode: React.Dispatch<React.SetStateAction<StudioMediaPickerErrorCode | null>>;
  setIsLoadingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSavingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setMetadataDraft: React.Dispatch<React.SetStateAction<StudioMediaPickerMetadataDraft>>;
  setMode: React.Dispatch<React.SetStateAction<StudioMediaPickerMode>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReviewAsset: React.Dispatch<React.SetStateAction<StudioMediaPickerAssetDetail | null>>;
  setReviewSource: React.Dispatch<React.SetStateAction<StudioMediaPickerReviewSource>>;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  setUploadPhase: React.Dispatch<React.SetStateAction<StudioMediaPickerUploadPhase>>;
}>) => {
  const resetTransientState = React.useCallback(() => {
    setSearchValue('');
    setUploadPhase('idle');
    setErrorCode(null);
    setReviewAsset(null);
    setMetadataDraft(emptyMetadataDraft);
    setIsLoadingReviewAsset(false);
    setIsSavingReviewAsset(false);
  }, [
    setErrorCode,
    setIsLoadingReviewAsset,
    setIsSavingReviewAsset,
    setMetadataDraft,
    setReviewAsset,
    setSearchValue,
    setUploadPhase,
  ]);

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

export const useStudioMediaPickerOverlayReviewActions = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  loadAsset,
  reviewSource,
  setErrorCode,
  setIsLoadingReviewAsset,
  setMetadataDraft,
  setMode,
  setReviewAsset,
  setReviewSource,
}: Readonly<{
  loadAsset: (assetId: string) => Promise<TAssetDetail>;
  reviewSource: StudioMediaPickerReviewSource;
  setErrorCode: React.Dispatch<React.SetStateAction<StudioMediaPickerErrorCode | null>>;
  setIsLoadingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setMetadataDraft: React.Dispatch<React.SetStateAction<StudioMediaPickerMetadataDraft>>;
  setMode: React.Dispatch<React.SetStateAction<StudioMediaPickerMode>>;
  setReviewAsset: React.Dispatch<React.SetStateAction<TAssetDetail | null>>;
  setReviewSource: React.Dispatch<React.SetStateAction<StudioMediaPickerReviewSource>>;
}>) => {
  const loadReviewAsset = React.useCallback(
    async (assetId: string, source: StudioMediaPickerReviewSource) => {
      setIsLoadingReviewAsset(true);
      setErrorCode(null);
      try {
        const asset = await loadAsset(assetId);
        setReviewAsset(asset);
        setMetadataDraft(createMetadataDraft(asset));
        setReviewSource(source);
        setMode('review');
      } catch {
        setErrorCode('asset_load_failed');
      } finally {
        setIsLoadingReviewAsset(false);
      }
    },
    [loadAsset, setErrorCode, setIsLoadingReviewAsset, setMetadataDraft, setMode, setReviewAsset, setReviewSource]
  );

  const selectAsset = React.useCallback(
    async (asset: StudioMediaPickerAssetSummary) => {
      await loadReviewAsset(asset.id, 'library');
    },
    [loadReviewAsset]
  );

  const updateMetadataField = React.useCallback(
    <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => {
      setMetadataDraft((current) => ({ ...current, [key]: value }));
      setErrorCode(null);
    },
    [setErrorCode, setMetadataDraft]
  );

  const goBackFromReview = React.useCallback(() => {
    setMode(reviewSource);
    setErrorCode(null);
  }, [reviewSource, setErrorCode, setMode]);

  return { goBackFromReview, loadReviewAsset, selectAsset, updateMetadataField } as const;
};
