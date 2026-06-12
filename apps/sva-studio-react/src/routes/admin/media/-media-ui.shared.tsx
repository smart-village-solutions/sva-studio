export type MediaDetailPageProps = {
  assetId: string;
};

const BUCKET_MEDIA_ID_PREFIX = 'bucket:';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const encodeBase64Url = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64url');
  }

  return bytesToBase64(textEncoder.encode(value))
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
  return textDecoder.decode(base64ToBytes(`${normalized}${padding}`));
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
