import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import React from 'react';

import type { NewsMediaContentFormValue } from './news.types.js';
import { mediaContentFromAsset, type MediaUploadPhase, uploadPhaseMessageKey } from './news.detail-media.helpers.js';
import { createEmptyMediaContent, useNewsUploadChangeHandler } from './news.detail-media-upload.js';

export function useNewsDetailMediaState({
  append,
  onUploadFile,
  remove,
}: Readonly<{
  append: (value: NewsMediaContentFormValue) => void;
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  remove: (index: number) => void;
}>) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [uploadPhase, setUploadPhase] = React.useState<MediaUploadPhase>('idle');
  const [uploadErrorKey, setUploadErrorKey] = React.useState<string | null>(null);
  const uploadMessageKey = uploadErrorKey ?? uploadPhaseMessageKey(uploadPhase);
  const uploadBusy = uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';

  const resetUploadStatus = React.useCallback(() => {
    setUploadPhase('idle');
    setUploadErrorKey(null);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setSearchValue('');
  }, []);

  const openDialog = React.useCallback(() => {
    resetUploadStatus();
    setDialogOpen(true);
  }, [resetUploadStatus]);

  const appendMediaContent = React.useCallback(
    (asset: HostMediaAssetListItem) => {
      const mediaContent = mediaContentFromAsset(asset);
      if (!mediaContent) {
        setUploadPhase('error');
        setUploadErrorKey('messages.mediaUploadUnavailableUrl');
        return false;
      }
      append(mediaContent);
      resetUploadStatus();
      return true;
    },
    [append, resetUploadStatus]
  );

  const handleSelectAsset = React.useCallback((asset: HostMediaAssetListItem) => {
    if (appendMediaContent(asset)) {
      closeDialog();
    }
  }, [appendMediaContent, closeDialog]);

  const handleRemove = React.useCallback((index: number) => {
    remove(index);
    resetUploadStatus();
  }, [remove, resetUploadStatus]);

  const handleManualAdd = React.useCallback(() => {
    append(createEmptyMediaContent());
    resetUploadStatus();
  }, [append, resetUploadStatus]);

  const handleUploadChange = useNewsUploadChangeHandler({
    appendMediaContent,
    onUploadFile,
    setUploadErrorKey,
    setUploadPhase,
  });

  return {
    closeDialog,
    dialogOpen,
    handleManualAdd,
    handleRemove,
    handleSelectAsset,
    handleUploadChange,
    openDialog,
    searchValue,
    setSearchValue,
    uploadBusy,
    uploadMessageKey,
    uploadPhase,
  };
}
