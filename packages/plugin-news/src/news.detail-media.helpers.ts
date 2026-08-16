import {
  getHostMediaAssetPersistentUrl,
  readHostMediaAssetCopyright,
  readHostMediaAssetFileName,
  readHostMediaAssetTitle,
  type HostMediaAssetListItem,
} from '@sva/plugin-sdk';

import type { NewsMediaContentFormValue } from './news.types.js';
import { normalizeMediaContentType } from './news.detail-media-content-type.js';

export const mediaContentTypeOptions = ['image', 'audio', 'video', 'logo', 'attachment'] as const;

export const mediaContentTypeFromAsset = (asset: HostMediaAssetListItem): string => {
  const mimeType = asset.mimeType?.trim();
  if (!mimeType) {
    return 'image';
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
  return normalizeMediaContentType(mimeType) ?? 'image';
};

export const mediaContentFromAsset = (asset: HostMediaAssetListItem): NewsMediaContentFormValue | null => {
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
    height: '',
    width: '',
  };
};

export const mediaContentSourceKey = (media: NewsMediaContentFormValue | undefined): string => media?.sourceUrl?.url?.trim() ?? '';
