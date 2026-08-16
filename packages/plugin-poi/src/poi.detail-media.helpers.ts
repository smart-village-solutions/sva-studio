import {
  getHostMediaAssetPersistentUrl,
  readHostMediaAssetCopyright,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';

import type { PoiMediaContent } from './poi.content.types.js';
import { normalizeMediaContentType } from './poi.detail-media-content-type.js';

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

export const mediaContentFromAsset = (asset: HostMediaAssetListItem): PoiMediaContent | null => {
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

export const mediaContentSourceKey = (media: PoiMediaContent | undefined): string => media?.sourceUrl?.url?.trim() ?? '';
