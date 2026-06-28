import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import React from 'react';
import type { UseFieldArrayAppend, UseFieldArrayRemove } from 'react-hook-form';

import { createDefaultMediaContent } from './poi.detail-form.defaults.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import {
  isSupportedUploadFile,
  mediaContentFromAsset,
  type MediaUploadPhase,
  uploadPhaseMessageKey,
} from './poi.detail-media.helpers.js';

const useUploadChangeHandler = ({
  appendMediaContent,
  onUploadFile,
  setUploadErrorKey,
  setUploadPhase,
}: Readonly<{
  appendMediaContent: (asset: HostMediaAssetListItem) => boolean;
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  setUploadErrorKey: (key: string | null) => void;
  setUploadPhase: (phase: MediaUploadPhase) => void;
}>) =>
  React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      if (!isSupportedUploadFile(file)) {
        setUploadPhase('error');
        setUploadErrorKey('messages.mediaUploadUnsupportedType');
        return;
      }

      setUploadPhase('initializing');
      setUploadErrorKey(null);
      try {
        setUploadPhase('uploading');
        const asset = await onUploadFile(file);
        setUploadPhase('finalizing');
        if (appendMediaContent(asset)) {
          setUploadPhase('success');
        }
      } catch {
        setUploadPhase('error');
        setUploadErrorKey('messages.mediaUploadError');
      }
    },
    [appendMediaContent, onUploadFile, setUploadErrorKey, setUploadPhase]
  );

export function usePoiDetailMediaState({
  append,
  onUploadFile,
  remove,
}: Readonly<{
  append: UseFieldArrayAppend<PoiDetailFormValues, 'content.mediaContents'>;
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
      append(mediaContent);
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
    append(createDefaultMediaContent());
    resetUploadStatus();
  }, [append, resetUploadStatus]);

  const handleUploadChange = useUploadChangeHandler({ appendMediaContent, onUploadFile, setUploadErrorKey, setUploadPhase });

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
