import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamMediaAsset, IamMediaDelivery } from '../../../lib/iam-api';

type MediaDetailWorkspaceHeaderProps = Readonly<{
  asset: IamMediaAsset;
  usageCount: number;
  delivery: IamMediaDelivery | null;
  onResolveDelivery: () => void;
  onDelete: () => void;
}>;

const usageCountLabel = (count: number): string =>
  count === 1 ? t('media.library.usageCountOne') : t('media.library.usageCountOther', { count });

export const MediaDetailWorkspaceHeader = ({
  asset,
  usageCount,
  delivery,
  onResolveDelivery,
  onDelete,
}: MediaDetailWorkspaceHeaderProps) => (
  <Card className="overflow-hidden border-border/70 bg-card/95 shadow-shell">
    <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,1fr)]">
      <div className="rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.2),_transparent_50%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(226,232,240,0.78))] p-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t('media.detail.previewEyebrow')}
          </p>
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">{t('media.detail.previewTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('media.detail.previewBody')}</p>
          </div>
          <div className="inline-flex rounded-full border border-foreground/10 bg-white/75 px-3 py-1 text-xs font-medium text-foreground">
            {asset.mimeType}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-foreground">{asset.metadata.title?.trim() || asset.id}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('media.detail.subtitle')}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t(`media.visibility.${asset.visibility}`)}</Badge>
            <Badge variant="outline">{t(`media.uploadStatus.${asset.uploadStatus}`)}</Badge>
            <Badge variant="outline">{t(`media.processingStatus.${asset.processingStatus}`)}</Badge>
            <Badge className="border-0 bg-cyan-500/15 text-cyan-700" variant="secondary">
              {usageCountLabel(usageCount)}
            </Badge>
            {delivery ? (
              <Badge className="border-0 bg-emerald-500/15 text-emerald-700" variant="secondary">
                {t('media.delivery.title')}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onResolveDelivery}>
            {t('media.actions.resolveDelivery')}
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            {t('media.actions.delete')}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
