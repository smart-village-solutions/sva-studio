import {
  getHostMediaAssetPersistentUrl,
  readHostMediaAssetCopyright,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';

import type { GenericItemMediaContent } from './generic-items.content-types.js';
import { normalizeMediaContentType } from './generic-items.detail-media-content-type.js';

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

export const mediaContentSourceKey = (media: GenericItemMediaContent | undefined): string => media?.sourceUrl?.url?.trim() ?? '';
