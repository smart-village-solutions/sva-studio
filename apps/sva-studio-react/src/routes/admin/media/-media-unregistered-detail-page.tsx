import { useNavigate } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { deriveMimeTypeFromUnregisteredMedia, useRegisterBucketMedia } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamUnregisteredMediaAsset } from '../../../lib/iam-api';

type MediaUnregisteredDetailPageProps = Readonly<{
  asset: IamUnregisteredMediaAsset | null;
}>;

const readValue = (value: string | null | undefined): string => value?.trim() || t('media.values.notAvailable');

const deriveDefaultTitle = (fileName: string): string => fileName.replace(/\.[^.]+$/, '');

export const MediaUnregisteredDetailPage = ({ asset }: MediaUnregisteredDetailPageProps) => {
  const navigate = useNavigate();
  const registration = useRegisterBucketMedia();

  const handleRegister = async () => {
    if (!asset) {
      return;
    }

    const registered = await registration.registerMedia({
      storageKey: asset.storageKey,
      fileName: asset.fileName,
      byteSize: asset.byteSize,
      mimeType: deriveMimeTypeFromUnregisteredMedia(asset),
      visibility: 'public',
      metadata: {
        title: deriveDefaultTitle(asset.fileName),
      },
    });

    if (!registered) {
      return;
    }

    await navigate({ to: '/admin/media/$mediaId', params: { mediaId: registered.id } });
  };

  if (!asset) {
    return (
      <section data-testid="media-unregistered-detail-page">
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{t('media.errors.notFound')}</AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="media-unregistered-detail-page">
      {registration.mutationError ? (
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{registration.mutationError.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-shell">
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,1fr)]">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-muted">
            {asset.previewUrl ? (
              <img alt={asset.fileName} className="h-full min-h-80 w-full object-cover" src={asset.previewUrl} />
            ) : (
              <div className="flex min-h-80 items-center justify-center p-6 text-sm text-muted-foreground">
                {t('media.library.assetCard.fallback')}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <h1 className="break-all text-3xl font-semibold text-foreground">{asset.fileName}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{t('media.unregistered.subtitle')}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t('media.library.assetCard.unregistered')}</Badge>
                <Badge variant="outline">{deriveMimeTypeFromUnregisteredMedia(asset)}</Badge>
                <Badge variant="outline">{readValue(asset.folderPath)}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleRegister()}>
                {t('media.actions.register')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,1fr)]">
        <Card className="border-border/70 bg-card/95 shadow-shell">
          <CardHeader>
            <CardTitle>{t('media.unregistered.metadataTitle')}</CardTitle>
            <CardDescription>{t('media.unregistered.metadataDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.title')}</p>
              <p className="text-sm text-foreground">{deriveDefaultTitle(asset.fileName)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.fields.altText')}</p>
              <p className="text-sm text-foreground">{t('media.unregistered.altTextHint')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-shell">
          <CardHeader>
            <CardTitle>{t('media.meta.title')}</CardTitle>
            <CardDescription>{t('media.unregistered.technicalDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.storageKey')}</p>
              <p className="break-all text-sm text-foreground">{asset.storageKey}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.mimeType')}</p>
              <p className="text-sm text-foreground">{deriveMimeTypeFromUnregisteredMedia(asset)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.byteSize')}</p>
              <p className="text-sm text-foreground">{String(asset.byteSize)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.folder')}</p>
              <p className="text-sm text-foreground">{readValue(asset.folderPath)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.deliveryUrl')}</p>
              <p className="break-all text-sm text-foreground">{readValue(asset.previewUrl)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('media.meta.updatedAt')}</p>
              <p className="text-sm text-foreground">{readValue(asset.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
