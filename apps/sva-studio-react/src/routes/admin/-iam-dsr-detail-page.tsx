import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import type { IamDsrCaseListItem } from '@sva/core';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import {
  getAllowedIamCockpitTabs,
  hasIamCockpitAccessRole,
  isIamCockpitEnabled,
} from '../../lib/iam-viewer-access';
import { getAdminDsrCase } from '../../lib/iam-api';
import { useAuth } from '../../providers/auth-provider';
import {
  mapDsrStatusToTranslationKey,
  mapDsrStatusTone,
  mapDsrTypeToTranslationKey,
} from './-iam.models';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const formatDateTime = (value?: string) => (value ? formatEditorDateTime(value) ?? value : '—');

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

const DsrDetailContent = ({ item }: Readonly<{ item: IamDsrCaseListItem }>) => {
  const requesterName = item.requesterDisplayName ?? item.actorDisplayName ?? '—';
  const completedAt = formatDateTime(item.completedAt ?? item.updatedAt);

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{item.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.summary}</p>
            </div>
            <Badge className={mapDsrStatusTone(item)} variant="outline">
              {t(mapDsrStatusToTranslationKey(item))}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailField label={t('admin.iam.shared.type', { value: '' }).replace(': ', '')} value={t(mapDsrTypeToTranslationKey(item.type))} />
          <DetailField label={t('admin.iam.shared.status')} value={item.rawStatus} />
          <DetailField label={t('admin.iam.shared.targetLabel')} value={item.targetDisplayName ?? '—'} />
          <DetailField label={t('admin.iam.shared.requester')} value={requesterName} />
          <DetailField label={t('admin.iam.dsr.columns.createdAt')} value={formatDateTime(item.createdAt)} />
          <DetailField label={t('admin.iam.dsr.columns.completedAt')} value={completedAt} />
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.dsr.columns.blocker')}</p>
            <p>{item.blockedReason ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.iam.shared.meta')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground">{formatMetadata(item.metadata)}</CardContent>
      </Card>
    </>
  );
};

export function IamDsrDetailPage({ caseId }: Readonly<{ caseId: string }>) {
  const navigate = useNavigate();
  const { user, isLoading: isLoadingUser, error: authError } = useAuth();
  const [item, setItem] = React.useState<IamDsrCaseListItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || !allowedTabs.includes('dsr') || !caseId) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void getAdminDsrCase(caseId, { signal: controller.signal })
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
  }, [allowedTabs, canAccessCockpit, caseId, cockpitEnabled]);

  if (isLoadingUser) {
    return <p className="text-sm text-muted-foreground">{t('admin.iam.messages.initializing')}</p>;
  }

  if (authError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{authError.message}</AlertDescription>
      </Alert>
    );
  }

  if (!cockpitEnabled) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
        <AlertDescription>{t('admin.iam.messages.disabled')}</AlertDescription>
      </Alert>
    );
  }

  if (!canAccessCockpit || !allowedTabs.includes('dsr')) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{t('admin.iam.messages.forbidden')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <StudioDetailPageTemplate
      title={item?.title ?? t('admin.iam.dsr.detail.title')}
      description={t('admin.iam.dsr.detail.subtitle')}
      actions={
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/admin/iam', search: { tab: 'dsr' } })}>
          {t('admin.iam.dsr.detail.back')}
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">{t('admin.iam.dsr.detail.loading')}</p> : null}
      {error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!isLoading && !error && !item ? (
        <Alert>
          <AlertDescription>{t('admin.iam.dsr.detail.notFound')}</AlertDescription>
        </Alert>
      ) : null}
      {item ? <DsrDetailContent item={item} /> : null}
    </StudioDetailPageTemplate>
  );
}
