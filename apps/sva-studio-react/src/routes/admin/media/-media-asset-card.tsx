import { Link } from '@tanstack/react-router';

import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { getActiveLocale, t } from '../../../i18n';
import { isRegisteredMediaAsset, type IamMediaAsset } from '../../../lib/iam-api';
import { cn } from '../../../lib/utils';

import { encodeBucketMediaId } from './-media-ui.shared.js';
import { resolveMediaCardState } from './-media-library-view-model.js';

type MediaAssetCardProps = Readonly<{
  asset: IamMediaAsset;
  referenceCount: number | null;
  usageStatus: 'loading' | 'ready' | 'unavailable';
}>;

const stateVariantByValue = {
  blocked: 'destructive',
  new: 'secondary',
  ready: 'secondary',
  unused: 'outline',
} as const;

const stateClassNameByValue = {
  blocked: '',
  new: '',
  ready: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700',
  unused: '',
} as const;

const formatByteSize = (byteSize: number): string => {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = byteSize / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const locale = getActiveLocale() === 'de' ? 'de-DE' : 'en-US';

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
};

const formatFileType = (mimeType: string | undefined): string => {
  if (!mimeType) {
    return t('media.library.assetCard.unknownType');
  }

  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  const [, subtype] = mimeType.split('/');
  return subtype ? subtype.toUpperCase() : mimeType.toUpperCase();
};

const imageMimeTypeByExtension: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

const inferMimeTypeFromFileName = (fileName: string): string | undefined => {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();
  return extension ? imageMimeTypeByExtension[extension] : undefined;
};

const isVisualPreview = (mimeType: string | undefined): boolean => typeof mimeType === 'string' && mimeType.startsWith('image/');

const getAssetLabel = (asset: IamMediaAsset): string =>
  isRegisteredMediaAsset(asset)
    ? asset.metadata.title?.trim() || asset.id
    : asset.fileName;

const usageCountLabel = (
  count: number | null,
  usageStatus: 'loading' | 'ready' | 'unavailable'
): string => {
  if (count === null) {
    return usageStatus === 'loading'
      ? t('media.library.usageCountLoading')
      : t('media.library.usageCountUnknown');
  }

  return count === 1
    ? t('media.library.usageCountOne')
    : t('media.library.usageCountOther', { count });
};

export const MediaAssetCard = ({ asset, referenceCount, usageStatus }: MediaAssetCardProps) => {
  const label = getAssetLabel(asset);
  const state = resolveMediaCardState(asset, referenceCount, usageStatus);
  const fileType = formatFileType(isRegisteredMediaAsset(asset) ? asset.mimeType : inferMimeTypeFromFileName(asset.fileName));
  const previewMimeType = isRegisteredMediaAsset(asset) ? asset.mimeType : inferMimeTypeFromFileName(asset.fileName);
  const previewUrl = !isRegisteredMediaAsset(asset) ? asset.previewUrl ?? undefined : undefined;
  const secondaryText = isRegisteredMediaAsset(asset)
    ? asset.metadata.altText?.trim() || asset.storageKey
    : asset.relativePath;
  const folderText =
    !isRegisteredMediaAsset(asset) && asset.folderPath.length > 0
      ? t('media.library.assetCard.folderValue', { folder: asset.folderPath })
      : null;
  const cardContent = (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-shell transition-colors hover:border-primary/30">
      <div
        className={cn(
          'flex min-h-28 items-center justify-center border-b border-border/60 text-center',
          previewUrl
            ? 'overflow-hidden bg-muted'
            : 'px-4 py-4',
          isVisualPreview(previewMimeType) && !previewUrl
            ? 'bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(226,232,240,0.82))]'
            : 'bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(148,163,184,0.16))]'
        )}
      >
        {isVisualPreview(previewMimeType) ? (
          previewUrl ? (
            <img
              alt={label}
              className="h-32 w-full object-cover"
              loading="lazy"
              src={previewUrl}
            />
          ) : (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{previewMimeType}</div>
              <div className="text-sm font-semibold text-foreground">{t('media.library.assetCard.preview')}</div>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <div className="text-2xl font-semibold tracking-[0.18em] text-foreground">{t('media.library.assetCard.document')}</div>
            <p className="text-xs text-muted-foreground">{t('media.library.assetCard.fallback')}</p>
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{label}</h2>
            <p className="line-clamp-2 text-xs text-muted-foreground">{secondaryText}</p>
            {folderText ? <p className="text-xs text-muted-foreground">{folderText}</p> : null}
          </div>
          <Badge className={stateClassNameByValue[state]} variant={stateVariantByValue[state]}>
            {t(`media.library.cardStates.${state}`)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{fileType}</Badge>
          <span>{formatByteSize(asset.byteSize)}</span>
          <span>{usageCountLabel(referenceCount, usageStatus)}</span>
        </div>
      </CardContent>
    </Card>
  );

  if (!isRegisteredMediaAsset(asset)) {
    return (
      <a
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/admin/media/${encodeBucketMediaId(asset.storageKey)}?storageKey=${encodeURIComponent(asset.storageKey)}&fileName=${encodeURIComponent(asset.fileName)}&folderPath=${encodeURIComponent(asset.folderPath)}&relativePath=${encodeURIComponent(asset.relativePath)}&byteSize=${asset.byteSize}&updatedAt=${encodeURIComponent(asset.updatedAt ?? '')}&lastModified=${encodeURIComponent(asset.lastModified ?? '')}&previewUrl=${encodeURIComponent(asset.previewUrl ?? '')}`}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" params={{ mediaId: asset.id }} to="/admin/media/$mediaId">
      {cardContent}
    </Link>
  );
};
