import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { getActiveLocale, t } from '../../../i18n';
import type { IamMediaAsset } from '../../../lib/iam-api';
import { cn } from '../../../lib/utils';

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

const formatFileType = (mimeType: string): string => {
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  const [, subtype] = mimeType.split('/');
  return subtype ? subtype.toUpperCase() : mimeType.toUpperCase();
};

const isVisualPreview = (mimeType: string): boolean => mimeType.startsWith('image/');

const getAssetLabel = (asset: IamMediaAsset): string => asset.metadata.title?.trim() || asset.id;

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
  const fileType = formatFileType(asset.mimeType);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-shell">
      <div
        className={cn(
          'flex min-h-40 items-center justify-center border-b border-border/60 px-6 py-8 text-center',
          isVisualPreview(asset.mimeType)
            ? 'bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(226,232,240,0.82))]'
            : 'bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(148,163,184,0.16))]'
        )}
      >
        {isVisualPreview(asset.mimeType) ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{asset.mimeType}</div>
            <div className="text-lg font-semibold text-foreground">{t('media.library.assetCard.preview')}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl font-semibold tracking-[0.18em] text-foreground">{t('media.library.assetCard.document')}</div>
            <p className="text-sm text-muted-foreground">{t('media.library.assetCard.fallback')}</p>
          </div>
        )}
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-base font-semibold text-foreground">{label}</h2>
            <p className="text-sm text-muted-foreground">{asset.metadata.altText?.trim() || asset.storageKey}</p>
          </div>
          <Badge className={stateClassNameByValue[state]} variant={stateVariantByValue[state]}>
            {t(`media.library.cardStates.${state}`)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{fileType}</Badge>
          <span>{formatByteSize(asset.byteSize)}</span>
          <span>{usageCountLabel(referenceCount, usageStatus)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
