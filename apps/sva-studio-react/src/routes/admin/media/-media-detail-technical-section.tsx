import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaAsset, IamMediaDelivery } from '../../../lib/iam-api';

type MediaDetailTechnicalSectionProps = Readonly<{
  asset: IamMediaAsset;
  delivery: IamMediaDelivery | null;
}>;

const readValue = (value: string | undefined): string => value?.trim() || t('media.values.notAvailable');

export const MediaDetailTechnicalSection = ({ asset, delivery }: MediaDetailTechnicalSectionProps) => (
  <Card className="border-border/70 bg-card/95 shadow-shell">
    <CardHeader>
      <CardTitle>{t('media.meta.title')}</CardTitle>
      <CardDescription>{t('media.detail.technicalDescription')}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.id')}</p>
        <p className="text-sm text-foreground">{asset.id}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.mimeType')}</p>
        <p className="text-sm text-foreground">{asset.mimeType}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.byteSize')}</p>
        <p className="text-sm text-foreground">{String(asset.byteSize)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.uploadStatus')}</p>
        <p className="text-sm text-foreground">{t(`media.uploadStatus.${asset.uploadStatus}`)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.processingStatus')}</p>
        <p className="text-sm text-foreground">{t(`media.processingStatus.${asset.processingStatus}`)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.uploadUrl')}</p>
        <p className="break-all text-sm text-foreground">{readValue(delivery?.deliveryUrl)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.expiresAt')}</p>
        <p className="text-sm text-foreground">{readValue(delivery?.expiresAt)}</p>
      </div>
    </CardContent>
  </Card>
);
