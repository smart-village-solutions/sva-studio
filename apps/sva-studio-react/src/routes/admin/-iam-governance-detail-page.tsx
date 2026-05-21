import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import type { IamGovernanceCaseListItem } from '@sva/core';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import {
  getAllowedIamCockpitTabs,
  hasIamCockpitAccessRole,
  isIamCockpitEnabled,
} from '../../lib/iam-viewer-access';
import { getGovernanceCase } from '../../lib/iam-api';
import { useAuth } from '../../providers/auth-provider';
import {
  formatGovernanceTitle,
  mapGovernanceTypeToTranslationKey,
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

export function IamGovernanceDetailPage({ caseId }: Readonly<{ caseId: string }>) {
  const navigate = useNavigate();
  const { user, isLoading: isLoadingUser, error: authError } = useAuth();
  const [item, setItem] = React.useState<IamGovernanceCaseListItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const cockpitEnabled = isIamCockpitEnabled();
  const canAccessCockpit = hasIamCockpitAccessRole(user);
  const allowedTabs = React.useMemo(() => getAllowedIamCockpitTabs(user), [user]);

  React.useEffect(() => {
    if (!cockpitEnabled || !canAccessCockpit || !allowedTabs.includes('governance') || !caseId) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void getGovernanceCase(caseId, { signal: controller.signal })
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

  if (!canAccessCockpit || !allowedTabs.includes('governance')) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{t('admin.iam.messages.forbidden')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <StudioDetailPageTemplate
      title={item ? formatGovernanceTitle(item) : t('admin.iam.governance.detail.title')}
      description={t('admin.iam.governance.detail.subtitle')}
      actions={
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/admin/iam', search: { tab: 'governance' } })}>
          {t('admin.iam.governance.detail.back')}
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">{t('admin.iam.governance.detail.loading')}</p> : null}
      {error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!isLoading && !error && !item ? (
        <Alert>
          <AlertDescription>{t('admin.iam.governance.detail.notFound')}</AlertDescription>
        </Alert>
      ) : null}
      {item ? (
        <>
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{formatGovernanceTitle(item)}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <Badge variant="outline">{item.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.type', { value: '' }).replace(': ', '')}</p>
                <p>{t(mapGovernanceTypeToTranslationKey(item.type))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.ticket', { value: '' }).replace(': ', '')}</p>
                <p>{item.ticketId ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.actor')}</p>
                <p>{item.actorDisplayName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.targetLabel')}</p>
                <p>{item.targetDisplayName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.shared.createdAt', { value: '' }).replace(': ', '')}</p>
                <p>{formatDateTime(item.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.iam.governance.columns.updatedAt')}</p>
                <p>{formatDateTime(item.updatedAt ?? item.resolvedAt)}</p>
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
      ) : null}
    </StudioDetailPageTemplate>
  );
}
