import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaAsset } from '../../../lib/iam-api';

type MediaDetailMetadataSectionProps = Readonly<{
  asset: IamMediaAsset;
}>;

const readTextValue = (value: string | undefined): string => value?.trim() || t('media.values.notAvailable');

export const MediaDetailMetadataSection = ({ asset }: MediaDetailMetadataSectionProps) => (
  <Card className="border-border/70 bg-card/95 shadow-shell">
    <CardHeader>
      <CardTitle>{t('media.editor.metadataTitle')}</CardTitle>
      <CardDescription>{t('media.detail.metadataDescription')}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.title')}</p>
        <p className="text-sm text-foreground">{readTextValue(asset.metadata.title)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.altText')}</p>
        <p className="text-sm text-foreground">{readTextValue(asset.metadata.altText)}</p>
      </div>
      <div className="space-y-1 md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {t('media.fields.description')}
        </p>
        <p className="text-sm text-foreground">{readTextValue(asset.metadata.description)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.copyright')}</p>
        <p className="text-sm text-foreground">{readTextValue(asset.metadata.copyright)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.license')}</p>
        <p className="text-sm text-foreground">{readTextValue(asset.metadata.license)}</p>
      </div>
    </CardContent>
  </Card>
);
