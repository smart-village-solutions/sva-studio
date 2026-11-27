import type { HostMediaAssetListItem, HostMediaReferenceSelection } from './media-picker-client.js';

export type HostMediaFieldOption = Readonly<{
  assetId: string;
  label: string;
}>;

export type ContentMediaUploadPhase =
  'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

const supportedContentMediaUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const compactOptionalString = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const toHostMediaFieldOptions = (
  assets: readonly HostMediaAssetListItem[]
): readonly HostMediaFieldOption[] => {
  const seenAssetIds = new Set<string>();

  return assets.flatMap((asset) => {
    if (seenAssetIds.has(asset.id)) {
      return [];
    }
    seenAssetIds.add(asset.id);
    return [
      {
        assetId: asset.id,
        label: String(asset.metadata?.title ?? asset.id),
      },
    ];
  });
};

export const isSupportedContentMediaUploadFile = (file: File): boolean =>
  supportedContentMediaUploadMimeTypes.has(file.type);

export const isMp3UploadFile = (file: File): boolean =>
  file.type === 'audio/mpeg' ||
  file.type === 'audio/mp3' ||
  ((!file.type || file.type === 'application/octet-stream') && /\.mp3$/iu.test(file.name));

export const contentMediaUploadPhaseMessageKey = (
  phase: ContentMediaUploadPhase
): string | null => {
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

export const readHostMediaAssetFileName = (asset: HostMediaAssetListItem): string =>
  asset.fileName?.trim() || asset.id;

export const readHostMediaAssetTitle = (asset: HostMediaAssetListItem): string => {
  const title = asset.metadata?.title;
  return typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : readHostMediaAssetFileName(asset);
};

export const readHostMediaAssetCopyright = (asset: HostMediaAssetListItem): string => {
  const copyright = asset.metadata?.copyright;
  return typeof copyright === 'string' ? copyright.trim() : '';
};

export const getHostMediaAssetPersistentUrl = (asset: HostMediaAssetListItem): string | null => {
  if (asset.visibility && asset.visibility !== 'public') {
    return null;
  }

  const url = asset.previewUrl?.trim();
  return url && url.length > 0 ? url : null;
};

export const findHostMediaReferenceAssetId = (
  references: readonly HostMediaReferenceSelection[],
  role: string
): string | null => references.find((reference) => reference.role === role)?.assetId ?? null;
