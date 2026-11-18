import { createHash } from 'node:crypto';

export type DeriveMediaPathInfoInput = Readonly<{
  instanceId: string;
  storageKey: string;
}>;

export type MediaPathInfo = Readonly<{
  fileName: string;
  folderPath: string;
  relativePath: string;
}>;

export const createMediaStorageInstancePrefix = (instanceId: string): string => `${instanceId}/`;

export const isMediaQuarantineKey = (storageKey: string): boolean =>
  storageKey.startsWith('.quarantine/');

export const isPrivateMediaStorageKey = (storageKey: string): boolean =>
  isMediaQuarantineKey(storageKey) || storageKey.startsWith('.protected/');

export const mediaProcessingPrefix = (
  instanceId: string,
  assetId: string,
  claimToken: string,
  privateOutput = false
): string =>
  `${privateOutput ? '.protected/' : ''}${instanceId}/variants/${assetId}/${claimToken}/`;

export const deriveMediaPathInfo = (input: DeriveMediaPathInfoInput): MediaPathInfo => {
  const prefix = createMediaStorageInstancePrefix(input.instanceId);
  const relativePath = input.storageKey.startsWith(prefix)
    ? input.storageKey.slice(prefix.length)
    : input.storageKey;
  const segments = relativePath.split('/').filter((segment) => segment.length > 0);
  const fileName = segments.length > 0 ? (segments[segments.length - 1] ?? '') : '';
  const folderPath = segments.slice(0, -1).join('/');

  return {
    fileName,
    folderPath,
    relativePath,
  };
};

export const isListableMediaStorageKey = (input: DeriveMediaPathInfoInput): boolean => {
  const { relativePath } = deriveMediaPathInfo(input);
  return relativePath.length > 0 && !relativePath.endsWith('/');
};

/** Stable, source-scoped UUID; the primary key prevents duplicate concurrent imports. */
export const deriveMediaImportAssetId = (
  instanceId: string,
  sourceId: string,
  storageKey: string
): string => {
  const hex = createHash('sha256')
    .update(JSON.stringify([instanceId, sourceId, storageKey]))
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
