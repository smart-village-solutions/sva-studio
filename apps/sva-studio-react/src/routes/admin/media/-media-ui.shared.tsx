export type MediaDetailPageProps = {
  assetId: string;
};

const BUCKET_MEDIA_ID_PREFIX = 'bucket:';

const encodeBase64Url = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64url');
  }

  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const decodeBase64Url = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf-8');
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return decodeURIComponent(escape(atob(`${normalized}${padding}`)));
};

export const encodeBucketMediaId = (storageKey: string): string =>
  `${BUCKET_MEDIA_ID_PREFIX}${encodeBase64Url(storageKey)}`;

export const decodeBucketMediaId = (mediaId: string): string | null => {
  if (!mediaId.startsWith(BUCKET_MEDIA_ID_PREFIX)) {
    return null;
  }

  try {
    return decodeBase64Url(mediaId.slice(BUCKET_MEDIA_ID_PREFIX.length));
  } catch {
    return null;
  }
};
