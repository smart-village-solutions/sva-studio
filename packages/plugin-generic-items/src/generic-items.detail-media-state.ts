import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import React from 'react';
import type { UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';

import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import {
  mediaContentFromAsset,
  type MediaUploadPhase,
  uploadPhaseMessageKey,
} from './generic-items.detail-media.helpers.js';
import {
  createEmptyMediaContent,
  useGenericItemsUploadChangeHandler,
} from './generic-items.detail-media-upload.js';

export function useGenericItemsDetailMediaState({
  append,
  onUploadFile,
  remove,
}: Readonly<{
  append: UseFieldArrayAppend<GenericItemsDetailFormValues, 'mediaContents'>;
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  remove: UseFieldArrayRemove;
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
      append({
        ...createEmptyMediaContent(),
        captionText: mediaContent.captionText ?? '',
        copyright: mediaContent.copyright ?? '',
        contentType: mediaContent.contentType ?? '',
        sourceUrl: {
          url: mediaContent.sourceUrl?.url ?? '',
          description: mediaContent.sourceUrl?.description ?? '',
        },
      });
      resetUploadStatus();
      return true;
    },
    [append, resetUploadStatus]
  );

  const handleSelectAsset = React.useCallback((asset: HostMediaAssetListItem) => {
    if (appendMediaContent(asset)) closeDialog();
  }, [appendMediaContent, closeDialog]);

  const handleRemove = React.useCallback((index: number) => {
    remove(index);
    resetUploadStatus();
  }, [remove, resetUploadStatus]);

  const handleManualAdd = React.useCallback(() => {
    append(createEmptyMediaContent());
    resetUploadStatus();
  }, [append, resetUploadStatus]);

  const handleUploadChange = useGenericItemsUploadChangeHandler({
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
