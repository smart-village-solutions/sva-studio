import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import type { IamSelfServiceActivityItem } from '@sva/core';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { t } from '../../i18n';
import { buildMyDataExportDownloadUrl, getMyDataSubjectRightsCase } from '../../lib/iam-api';
import {
  formatPrivacyDateTime,
  mapDsrStatusKey,
  mapDsrStatusTone,
  mapPrivacyTypeKey,
} from './-account-privacy-shared';

const formatMetadata = (metadata: Readonly<Record<string, unknown>>) => {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) {
    return '—';
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
};

const DetailField = ({ label, value }: Readonly<{ label: string; value: string }>) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p>{value}</p>
  </div>
);

const PrivacyDetailContent = ({ item }: Readonly<{ item: IamSelfServiceActivityItem }>) => (
  <>
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{item.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
          </div>
          <Badge className={mapDsrStatusTone(item.canonicalStatus)} variant="outline">
            {t(mapDsrStatusKey(item.canonicalStatus))}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <DetailField label={t('account.privacy.table.columns.type')} value={t(mapPrivacyTypeKey(item.type))} />
        <DetailField label={t('account.privacy.table.columns.status')} value={item.rawStatus} />
        <DetailField label={t('account.privacy.detail.caseId')} value={item.id} />
        <DetailField label={t('account.privacy.table.columns.createdAt')} value={formatPrivacyDateTime(item.createdAt)} />
        <DetailField
          label={t('account.privacy.table.columns.updatedAt')}
          value={formatPrivacyDateTime(item.completedAt ?? item.updatedAt ?? item.createdAt)}
        />
        <DetailField label={t('account.privacy.table.columns.details')} value={item.summary} />
        {item.type === 'export_job' && item.canonicalStatus === 'completed' && item.format ? (
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.assign(buildMyDataExportDownloadUrl(item.id, item.format as 'json' | 'csv' | 'xml'))}
            >
              {t('account.privacy.table.actions.download')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{t('account.privacy.table.columns.details')}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-foreground">{formatMetadata(item.metadata)}</CardContent>
    </Card>
  </>
);

type AccountPrivacyDetailPageProps = Readonly<{
  caseId: string;
}>;

export const AccountPrivacyDetailPage = ({ caseId }: AccountPrivacyDetailPageProps) => {
  const navigate = useNavigate();
  const [item, setItem] = React.useState<IamSelfServiceActivityItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!caseId) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getMyDataSubjectRightsCase(caseId, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setItem(response.data);
        }
      })
      .catch((currentError) => {
        if (!controller.signal.aborted) {
          setItem(null);
          setError(currentError instanceof Error ? currentError.message : String(currentError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [caseId]);

  return (
    <StudioDetailPageTemplate
      title={item?.title ?? t('account.privacy.detail.title')}
      description={t('account.privacy.detail.subtitle')}
      actions={
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/account/privacy' })}>
          {t('account.privacy.detail.back')}
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">{t('account.privacy.detail.loading')}</p> : null}
      {error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!isLoading && !error && !item ? (
        <Alert>
          <AlertDescription>{t('account.privacy.detail.notFound')}</AlertDescription>
        </Alert>
      ) : null}
      {item ? <PrivacyDetailContent item={item} /> : null}
    </StudioDetailPageTemplate>
  );
};
