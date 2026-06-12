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

export const deriveMediaPathInfo = (input: DeriveMediaPathInfoInput): MediaPathInfo => {
  const prefix = createMediaStorageInstancePrefix(input.instanceId);
  const relativePath = input.storageKey.startsWith(prefix) ? input.storageKey.slice(prefix.length) : input.storageKey;
  const segments = relativePath.split('/').filter((segment) => segment.length > 0);
  const fileName = segments.length > 0 ? segments[segments.length - 1] ?? '' : '';
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
