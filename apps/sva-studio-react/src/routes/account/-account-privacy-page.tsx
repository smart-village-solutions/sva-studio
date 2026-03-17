import type { IamDsrCaseListItem } from '@sva/core';
import React from 'react';

import {
  checkOptionalProcessing,
  createDataSubjectRequest,
  getMyDataSubjectRights,
  requestDataExport,
} from '../../lib/iam-api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { t } from '../../i18n';

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const mapDsrStatusKey = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'queued':
      return 'account.privacy.status.queued';
    case 'in_progress':
      return 'account.privacy.status.inProgress';
    case 'completed':
      return 'account.privacy.status.completed';
    case 'blocked':
      return 'account.privacy.status.blocked';
    default:
      return 'account.privacy.status.failed';
  }
};

const mapDsrStatusTone = (item: Pick<IamDsrCaseListItem, 'canonicalStatus'>) => {
  switch (item.canonicalStatus) {
    case 'completed':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'blocked':
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    default:
      return 'border-secondary/40 bg-secondary/10 text-secondary';
  }
};

const DsrCaseRow = ({ item }: Readonly<{ item: IamDsrCaseListItem }>) => (
  <Card className="bg-background shadow-none">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          <p className="text-xs text-muted-foreground">{item.summary}</p>
        </div>
        <div className="text-right">
          <Badge className={mapDsrStatusTone(item)} variant="outline">
            {t(mapDsrStatusKey(item))}
          </Badge>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('account.privacy.shared.rawStatus', { value: item.rawStatus })}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{t('account.privacy.shared.createdAt', { value: formatDateTime(item.createdAt) })}</span>
        {item.completedAt ? (
          <span>{t('account.privacy.shared.completedAt', { value: formatDateTime(item.completedAt) })}</span>
        ) : null}
        {item.format ? <span>{t('account.privacy.shared.format', { value: item.format })}</span> : null}
        {item.blockedReason ? <span>{t('account.privacy.shared.blockedBy', { value: item.blockedReason })}</span> : null}
      </div>
    </CardContent>
  </Card>
);

export const AccountPrivacyPage = () => {
  const [overview, setOverview] = React.useState<Awaited<ReturnType<typeof getMyDataSubjectRights>>['data'] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getMyDataSubjectRights();
      setOverview(response.data);
    } catch (error) {
      setOverview(null);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const runAction = async (work: () => Promise<void>) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await work();
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasNoEntries =
    overview &&
    overview.requests.length === 0 &&
    overview.exportJobs.length === 0 &&
    overview.legalHolds.length === 0;

  return (
    <section className="space-y-5" aria-busy={isLoading || isSubmitting}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.privacy.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('account.privacy.subtitle')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,1fr)]">
        <section className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  void runAction(async () => {
                    await requestDataExport({ format: 'json', async: true });
                    setStatusMessage(t('account.privacy.actions.exportQueued'));
                  })
                }
              >
                {t('account.privacy.actions.requestExport')}
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                variant="outline"
                onClick={() =>
                  void runAction(async () => {
                    await createDataSubjectRequest({ type: 'access' });
                    setStatusMessage(t('account.privacy.actions.accessRequested'));
                  })
                }
              >
                {t('account.privacy.actions.requestAccess')}
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                variant="outline"
                onClick={() =>
                  void runAction(async () => {
                    await createDataSubjectRequest({ type: 'objection' });
                    setStatusMessage(t('account.privacy.actions.optOutRequested'));
                  })
                }
              >
                {t('account.privacy.actions.optOut')}
              </Button>
            </CardContent>
          </Card>

          {statusMessage ? (
            <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null}
          {errorMessage ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? <p className="text-sm text-muted-foreground">{t('account.privacy.messages.loading')}</p> : null}

          {hasNoEntries ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>{t('account.privacy.empty.title')}</CardTitle>
                <CardDescription>{t('account.privacy.empty.body')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    void runAction(async () => {
                      await createDataSubjectRequest({ type: 'access' });
                      setStatusMessage(t('account.privacy.actions.accessRequested'));
                    })
                  }
                >
                  {t('account.privacy.empty.cta')}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {overview?.exportJobs.length ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{t('account.privacy.sections.exportJobs')}</h2>
              <div className="space-y-3">
                {overview.exportJobs.map((item) => (
                  <DsrCaseRow key={`export-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {overview?.requests.length ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{t('account.privacy.sections.requests')}</h2>
              <div className="space-y-3">
                {overview.requests.map((item) => (
                  <DsrCaseRow key={`request-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle>{t('account.privacy.sections.processing')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.privacy.processing.optional')}</dt>
                <dd className="text-foreground">
                  {overview?.nonEssentialProcessingAllowed
                    ? t('account.privacy.processing.allowed')
                    : t('account.privacy.processing.restricted')}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.processing.restrictionSince')}
                </dt>
                <dd className="text-foreground">{formatDateTime(overview?.processingRestrictedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.privacy.processing.reason')}</dt>
                <dd className="text-foreground">{overview?.processingRestrictionReason ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('account.privacy.processing.optOutSince')}</dt>
                <dd className="text-foreground">{formatDateTime(overview?.nonEssentialProcessingOptOutAt)}</dd>
              </div>
            </dl>
            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting}
              variant="outline"
              onClick={() =>
                void runAction(async () => {
                  const response = await checkOptionalProcessing();
                  if ('error' in response) {
                    setStatusMessage(
                      response.blockedByRestriction || response.blockedByObjection
                        ? t('account.privacy.processing.blocked')
                        : response.error
                    );
                    return;
                  }
                  setStatusMessage(t('account.privacy.processing.allowedCheck'));
                })
              }
            >
              {t('account.privacy.actions.checkProcessing')}
            </Button>

            {overview?.legalHolds.length ? (
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">{t('account.privacy.sections.legalHolds')}</h3>
                {overview.legalHolds.map((item) => (
                  <DsrCaseRow key={`hold-${item.id}`} item={item} />
                ))}
              </section>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
