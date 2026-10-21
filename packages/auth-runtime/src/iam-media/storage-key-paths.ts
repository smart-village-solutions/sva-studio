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
