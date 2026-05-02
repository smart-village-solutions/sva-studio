import { Link, useParams } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { useMediaDetail } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const mediaErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('media.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    case 'notFound':
    case 'not_found':
      return t('media.errors.notFound');
    default:
      return t('media.messages.loadError');
  }
};

const mediaRoleKeyByValue = {
  thumbnail: 'media.roles.thumbnail',
  teaser_image: 'media.roles.teaser_image',
  header_image: 'media.roles.header_image',
  gallery_item: 'media.roles.gallery_item',
  download: 'media.roles.download',
  hero_image: 'media.roles.hero_image',
} as const;

const formatMediaRole = (role: string): string =>
  role in mediaRoleKeyByValue ? t(mediaRoleKeyByValue[role as keyof typeof mediaRoleKeyByValue]) : role;

export const MediaUsagePage = () => {
  const params = useParams({ strict: false });
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : null;
  const mediaApi = useMediaDetail(mediaId);

  if (mediaApi.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>;
  }

  if (!mediaApi.asset || !mediaApi.usage) {
    return (
      <Alert className="border-destructive/40 text-destructive">
        <AlertDescription>{mediaErrorMessage(mediaApi.error)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('media.usage.pageTitle')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('media.usage.pageSubtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/media/$mediaId" params={{ mediaId: mediaApi.asset.id }}>
              {t('media.actions.backToDetail')}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/media">{t('media.actions.back')}</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('media.usage.assetTitle')}</CardTitle>
          <CardDescription>{mediaApi.asset.metadata.title?.trim() || mediaApi.asset.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('media.meta.id')}: {mediaApi.asset.id}</p>
          <p>{t('media.meta.mimeType')}: {mediaApi.asset.mimeType}</p>
          <p>{t('media.usage.summary', { count: mediaApi.usage.totalReferences })}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {mediaApi.usage.references.length ? (
          mediaApi.usage.references.map((reference) => (
            <Card key={reference.id}>
              <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{reference.targetType}</p>
                  <p className="text-sm text-muted-foreground">{reference.targetId}</p>
                  <p className="text-sm text-muted-foreground">{reference.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{formatMediaRole(reference.role)}</Badge>
                  {typeof reference.sortOrder === 'number' ? (
                    <Badge variant="secondary">{t('media.usage.sortOrder', { value: String(reference.sortOrder) })}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Alert>
            <AlertDescription>{t('media.usage.empty')}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
};
