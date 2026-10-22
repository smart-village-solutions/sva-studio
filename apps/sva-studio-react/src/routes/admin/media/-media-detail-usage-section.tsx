import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { t } from '../../../i18n';
import { Link } from '@tanstack/react-router';
import type { IamMediaUsageImpact } from '../../../lib/iam-api';

type MediaDetailUsageSectionProps = Readonly<{
  usage: IamMediaUsageImpact;
}>;

const mediaRoleKeyByValue = {
  thumbnail: 'media.roles.thumbnail',
  teaser_image: 'media.roles.teaser_image',
  header_image: 'media.roles.header_image',
  gallery_item: 'media.roles.gallery_item',
  download: 'media.roles.download',
  hero_image: 'media.roles.hero_image',
} as const;

const formatMediaRole = (role: string): string =>
  role in mediaRoleKeyByValue
    ? t(mediaRoleKeyByValue[role as keyof typeof mediaRoleKeyByValue])
    : role;

export const MediaDetailUsageSection = ({ usage }: MediaDetailUsageSectionProps) => (
  <Card className="border-border/70 bg-card/95 shadow-shell">
    <CardHeader>
      <CardTitle>{t('media.usage.title')}</CardTitle>
      <CardDescription>{t('media.detail.usageDescription')}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        {t('media.usage.summary', { count: usage.totalReferences })}
      </p>

      {usage.editingSource ? (
        <p className="text-sm">
          {t('media.usage.editingSource')}{' '}
          <Link
            to="/admin/media/$mediaId"
            params={{ mediaId: usage.editingSource.assetId }}
            className="text-primary underline underline-offset-4"
          >
            {usage.editingSource.title || t('media.usage.sourceImage')}
          </Link>
        </p>
      ) : null}
      {usage.editingDependencies?.total ? (
        <div className="space-y-2 rounded-xl border border-border/60 p-4">
          <p className="font-medium">
            {t('media.usage.editingDependencies', { count: usage.editingDependencies.total })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('media.usage.editingDependenciesHint')}
          </p>
          <ul className="space-y-2">
            {usage.editingDependencies.items.map((copy) => (
              <li key={copy.assetId}>
                <Link
                  to="/admin/media/$mediaId"
                  params={{ mediaId: copy.assetId }}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {copy.title || t('media.usage.editedCopy')}
                </Link>
              </li>
            ))}
          </ul>
          {usage.editingDependencies.items.length < usage.editingDependencies.total ? (
            <p className="text-sm text-muted-foreground">
              {t('media.usage.hiddenEditingDependencies')}
            </p>
          ) : null}
        </div>
      ) : null}

      {usage.references.length ? (
        <div className="space-y-3">
          {usage.references.map((reference) => (
            <div
              key={reference.id}
              className="rounded-2xl border border-border/60 bg-background/70 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{reference.targetType}</p>
                  <p className="text-sm text-muted-foreground">{reference.targetId}</p>
                  <p className="text-xs text-muted-foreground">{reference.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatMediaRole(reference.role)}</Badge>
                  {typeof reference.sortOrder === 'number' ? (
                    <Badge variant="secondary">
                      {t('media.usage.sortOrder', { value: String(reference.sortOrder) })}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Alert>
          <AlertDescription>{t('media.usage.empty')}</AlertDescription>
        </Alert>
      )}
    </CardContent>
  </Card>
);
