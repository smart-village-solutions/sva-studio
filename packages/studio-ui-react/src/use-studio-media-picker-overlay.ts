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

type UseStudioMediaPickerOverlayOptions<TAssetDetail extends StudioMediaPickerAssetDetail> = Readonly<{
  onAccept: (asset: TAssetDetail) => void;
  isSupportedUploadFile: (file: File) => boolean;
  uploadAsset: (file: File) => Promise<{ readonly assetId: string }>;
  loadAsset: (assetId: string) => Promise<TAssetDetail>;
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataDraft) => Promise<TAssetDetail>;
  canAcceptAsset?: (asset: TAssetDetail) => boolean;
}>;

const emptyMetadataDraft: StudioMediaPickerMetadataDraft = {
  title: '',
  altText: '',
  description: '',
  copyright: '',
  license: '',
};

export const useStudioMediaPickerOverlay = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  isSupportedUploadFile,
  loadAsset,
  onAccept,
  saveAssetMetadata,
  uploadAsset,
}: UseStudioMediaPickerOverlayOptions<TAssetDetail>) => {
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
    [loadAsset]
  );

  const selectAsset = React.useCallback(
    async (asset: StudioMediaPickerAssetSummary) => {
      await loadReviewAsset(asset.id, 'library');
    },
    [loadReviewAsset]
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      if (!isSupportedUploadFile(file)) {
        setErrorCode('unsupported_upload_type');
        setUploadPhase('error');
        return;
      }

      setUploadPhase('initializing');
      setErrorCode(null);

      try {
        setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        setUploadPhase('finalizing');
        await loadReviewAsset(uploaded.assetId, 'upload');
        setUploadPhase('success');
      } catch {
        setUploadPhase('error');
        setErrorCode('upload_failed');
      }
    },
    [isSupportedUploadFile, loadReviewAsset, uploadAsset]
  );

  const updateMetadataField = React.useCallback(
    <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => {
      setMetadataDraft((current) => ({
        ...current,
        [key]: value,
      }));
      setErrorCode(null);
    },
    []
  );

  const goBackFromReview = React.useCallback(() => {
    setMode(reviewSource);
    setErrorCode(null);
  }, [reviewSource]);

  const confirmSelection = React.useCallback(async () => {
    if (!reviewAsset) {
      return;
    }

    setIsSavingReviewAsset(true);
    setErrorCode(null);

    try {
      const updatedAsset = await saveAssetMetadata(reviewAsset.id, metadataDraft);
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        setReviewAsset(updatedAsset);
        setMetadataDraft(createMetadataDraft(updatedAsset));
        setErrorCode('asset_unavailable');
        return;
      }
      setReviewAsset(updatedAsset);
      setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      close();
    } catch {
      setErrorCode('metadata_save_failed');
    } finally {
      setIsSavingReviewAsset(false);
    }
  }, [canAcceptAsset, close, metadataDraft, onAccept, reviewAsset, saveAssetMetadata]);

  return {
    open,
    mode,
    reviewSource,
    searchValue,
    setSearchValue,
    uploadPhase,
    errorCode,
    reviewAsset,
    metadataDraft,
    isLoadingReviewAsset,
    isSavingReviewAsset,
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
