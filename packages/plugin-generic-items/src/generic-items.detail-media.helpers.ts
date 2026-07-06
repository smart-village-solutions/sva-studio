import type { HostMediaAssetListItem } from '@sva/plugin-sdk';

import type { GenericItemMediaContent } from './generic-items.content-types.js';
import { normalizeMediaContentType } from './generic-items.detail-media-content-type.js';

export type MediaUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

const acceptedUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const isSupportedUploadFile = (file: File): boolean => acceptedUploadMimeTypes.has(file.type);

export const uploadPhaseMessageKey = (phase: MediaUploadPhase): string | null => {
  switch (phase) {
    case 'initializing':
      return 'messages.mediaUploadInitializing';
    case 'uploading':
      return 'messages.mediaUploadUploading';
    case 'finalizing':
      return 'messages.mediaUploadFinalizing';
    case 'success':
      return 'messages.mediaUploadSuccess';
    case 'error':
      return 'messages.mediaUploadError';
    case 'idle':
      return null;
  }
};

export const readAssetTitle = (asset: HostMediaAssetListItem): string => {
  const title = asset.metadata?.title;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : asset.fileName?.trim() || asset.id;
};

export const readAssetFileName = (asset: HostMediaAssetListItem): string => asset.fileName?.trim() || asset.id;

export const readAssetCopyright = (asset: HostMediaAssetListItem): string => {
  const copyright = asset.metadata?.copyright;
  return typeof copyright === 'string' ? copyright.trim() : '';
};

export const getAssetPersistentUrl = (asset: HostMediaAssetListItem): string | null => {
  if (asset.visibility && asset.visibility !== 'public') {
    return null;
  }
  const url = asset.previewUrl?.trim();
  return url && url.length > 0 ? url : null;
};

export const normalizeSearchValue = (value: string): string => value.trim().toLocaleLowerCase('de-DE');

export const matchesAssetSearch = (asset: HostMediaAssetListItem, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  return normalizeSearchValue(readAssetTitle(asset)).includes(query) || normalizeSearchValue(readAssetFileName(asset)).includes(query);
};

export const mediaContentTypeFromAsset = (asset: HostMediaAssetListItem): string => {
  const mimeType = asset.mimeType?.trim();
  if (!mimeType) {
    return '';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return normalizeMediaContentType(mimeType) ?? '';
};

export const mediaContentFromAsset = (asset: HostMediaAssetListItem): GenericItemMediaContent | null => {
  const url = getAssetPersistentUrl(asset);
  if (!url) {
    return null;
  }

  return {
    captionText: readAssetTitle(asset),
    copyright: readAssetCopyright(asset),
    contentType: mediaContentTypeFromAsset(asset),
    sourceUrl: {
      url,
      description: readAssetFileName(asset),
    },
  };
};

export const mediaContentSourceKey = (media: GenericItemMediaContent | undefined): string => media?.sourceUrl?.url?.trim() ?? '';
