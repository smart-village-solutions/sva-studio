import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaAsset } from '../../../lib/iam-api';

type MediaDetailImageControlsSectionProps = Readonly<{
  asset: IamMediaAsset;
}>;

const readNumericValue = (value: number | undefined): string =>
  typeof value === 'number' ? String(value) : t('media.values.notAvailable');

export const MediaDetailImageControlsSection = ({ asset }: MediaDetailImageControlsSectionProps) => (
  <Card className="border-border/70 bg-card/95 shadow-shell">
    <CardHeader>
      <CardTitle>{t('media.detail.imageControlsTitle')}</CardTitle>
      <CardDescription>{t('media.detail.imageControlsDescription')}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.focusPointX')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.focusPoint?.x)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.focusPointY')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.focusPoint?.y)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.cropX')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.crop?.x)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.cropY')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.crop?.y)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.cropWidth')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.crop?.width)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.cropHeight')}</p>
        <p className="text-sm text-foreground">{readNumericValue(asset.metadata.crop?.height)}</p>
      </div>
    </CardContent>
  </Card>
);
