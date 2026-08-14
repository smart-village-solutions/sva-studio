import {
  getHostMediaAssetPersistentUrl,
  readHostMediaAssetCopyright,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';

import type { EventMediaContent } from './events.types.js';
import { normalizeMediaContentType } from './events.detail-media-content-type.js';

export const mediaContentTypeOptions = ['image', 'audio', 'video', 'logo', 'attachment'] as const;

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

export const mediaContentFromAsset = (asset: HostMediaAssetListItem): EventMediaContent | null => {
  const url = getHostMediaAssetPersistentUrl(asset);
  if (!url) {
    return null;
  }

  return {
    captionText: readHostMediaAssetTitle(asset),
    copyright: readHostMediaAssetCopyright(asset),
    contentType: mediaContentTypeFromAsset(asset),
    sourceUrl: {
      url,
      description: readHostMediaAssetFileName(asset),
    },
  };
};
