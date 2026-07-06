import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import React from 'react';

import { isSupportedUploadFile, type MediaUploadPhase } from './news.detail-media.helpers.js';
import type { NewsMediaContentFormValue } from './news.types.js';

export const createEmptyMediaContent = (): NewsMediaContentFormValue => ({
  captionText: '',
  copyright: '',
  contentType: 'image',
  height: '',
  width: '',
  sourceUrl: { url: '', description: '' },
});

export const useNewsUploadChangeHandler = ({
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
