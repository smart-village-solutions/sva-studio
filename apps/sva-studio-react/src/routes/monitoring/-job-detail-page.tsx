import type { StudioJobDetail } from '@sva/core';
import { Link } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { usePluginOperationJobDetail } from '../../hooks/use-plugin-operation-jobs';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
import {
  formatMonitoringJobEventMessage,
  formatMonitoringJobEventTitle,
  resolveMonitoringJobEventTone,
} from './job-event-presentation';

type MonitoringJobDetailPageProps = Readonly<{
  jobId: string;
}>;

const statusVariantByValue = {
  queued: 'outline',
  running: 'secondary',
  retrying: 'secondary',
  succeeded: 'default',
  failed: 'destructive',
  cancelled: 'destructive',
} as const;

const statusLabelKeyByValue = {
  queued: 'monitoring.jobs.status.queued',
  running: 'monitoring.jobs.status.running',
  retrying: 'monitoring.jobs.status.retrying',
  succeeded: 'monitoring.jobs.status.succeeded',
  failed: 'monitoring.jobs.status.failed',
  cancelled: 'monitoring.jobs.status.cancelled',
} as const;

const staleStateLabelKeyByValue = {
  fresh: 'monitoring.jobs.runtime.fresh',
  stale: 'monitoring.jobs.runtime.stale',
  terminal: 'monitoring.jobs.runtime.terminal',
} as const;

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('monitoring.jobs.values.notAvailable');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatStructuredValue = (value: unknown): string => {
  const json = JSON.stringify(value, null, 2);
  return json && json.length > 0 ? json : '{}';
};

const formatProgressSummary = (job: StudioJobDetail): string => {
  if (!job.progress) {
    return t('monitoring.jobs.values.notAvailable');
  }

  const percent = job.progress.totalSteps > 0 ? Math.round((job.progress.completedSteps / job.progress.totalSteps) * 100) : 0;
  return t('monitoring.jobs.progress.summary', {
    current: job.progress.completedSteps,
    total: job.progress.totalSteps,
    percent,
  });
};

const jobsErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('monitoring.jobs.messages.detailLoadError');
  }

  switch (error.code) {
    case 'not_found':
      return t('monitoring.jobs.errors.notFound');
    case 'forbidden':
      return t('monitoring.jobs.errors.forbidden');
    case 'database_unavailable':
      return t('monitoring.jobs.errors.databaseUnavailable');
    default:
      return t('monitoring.jobs.messages.detailLoadError');
  }
};

export const MonitoringJobDetailPage = ({ jobId }: MonitoringJobDetailPageProps) => {
  const jobApi = usePluginOperationJobDetail(jobId);
  const job = jobApi.detail;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={job ? statusVariantByValue[job.status] : 'outline'}>
              {job ? t(statusLabelKeyByValue[job.status]) : t('monitoring.jobs.status.queued')}
            </Badge>
            {job?.runtime ? (
              <Badge variant={job.runtime.staleState === 'stale' ? 'destructive' : 'outline'}>
                {t(staleStateLabelKeyByValue[job.runtime.staleState])}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold text-foreground">{t('monitoring.jobs.detail.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('monitoring.jobs.detail.subtitle')}</p>
          <p className="text-xs text-muted-foreground">{jobId}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/monitoring/jobs">{t('monitoring.jobs.detail.back')}</Link>
        </Button>
      </header>

      {jobApi.error ? (
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{jobsErrorMessage(jobApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {jobApi.isLoading && !job ? <p className="text-sm text-muted-foreground">{t('monitoring.jobs.messages.loading')}</p> : null}

      {job ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('monitoring.jobs.detail.summaryTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{t('monitoring.jobs.labels.pluginId', { value: job.pluginId })}</p>
                <p>{t('monitoring.jobs.labels.jobTypeId', { value: job.jobTypeId })}</p>
                <p>{t('monitoring.jobs.labels.correlationId', { value: job.correlationId ?? t('monitoring.jobs.values.notAvailable') })}</p>
                <p>{t('monitoring.jobs.labels.parentJobId', { value: job.parentJobId ?? t('monitoring.jobs.values.notAvailable') })}</p>
                <p>{t('monitoring.jobs.labels.workerId', { value: job.workerId ?? t('monitoring.jobs.values.notAvailable') })}</p>
                <p>{t('monitoring.jobs.labels.attempts', { current: job.attempts, max: job.maxAttempts })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('monitoring.jobs.detail.runtimeTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{t('monitoring.jobs.progress.current', { value: formatProgressSummary(job) })}</p>
                <p>
                  {t('monitoring.jobs.progress.step', {
                    value: job.progress?.currentStepLabel ?? job.progress?.currentStepKey ?? t('monitoring.jobs.values.notAvailable'),
                  })}
                </p>
                <p>{t('monitoring.jobs.labels.startedAt', { value: formatDateTime(job.startedAt) })}</p>
                <p>{t('monitoring.jobs.labels.lastObservedAt', { value: formatDateTime(job.runtime?.lastObservedAt) })}</p>
                <p>{t('monitoring.jobs.labels.finishedAt', { value: formatDateTime(job.finishedAt) })}</p>
                <p>
                  {t('monitoring.jobs.labels.cancellationRequested', {
                    value: job.runtime?.cancellationRequested
                      ? t('monitoring.jobs.values.yes')
                      : t('monitoring.jobs.values.no'),
                  })}
                </p>
              </CardContent>
            </Card>
          </div>

          {job.resultPayload ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('monitoring.jobs.detail.resultTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-4 text-xs text-foreground">
                  {formatStructuredValue(job.resultPayload)}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {job.errorPayload ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('monitoring.jobs.detail.errorTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="destructive">{job.errorPayload.code}</Badge>
                  <Badge variant="outline">{job.errorPayload.category}</Badge>
                </div>
                {job.errorPayload.message ? <p className="text-sm">{job.errorPayload.message}</p> : null}
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-4 text-xs text-foreground">
                  {formatStructuredValue(job.errorPayload.details)}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('monitoring.jobs.detail.historyTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('monitoring.jobs.empty.history')}</p>
              ) : (
                <ol className="space-y-4">
                  {job.history.map((event) => (
                    <li key={event.id} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={resolveMonitoringJobEventTone(event) === 'error' ? 'destructive' : 'outline'}>
                              {formatMonitoringJobEventTitle(event)}
                            </Badge>
                            <Badge variant={statusVariantByValue[event.status]}>{t(statusLabelKeyByValue[event.status])}</Badge>
                          </div>
                          <p className="text-sm">{formatMonitoringJobEventMessage(event) ?? t('monitoring.jobs.values.notAvailable')}</p>
                          {event.progress ? (
                            <p className="text-xs text-muted-foreground">
                              {t('monitoring.jobs.progress.summary', {
                                current: event.progress.completedSteps,
                                total: event.progress.totalSteps,
                                percent:
                                  event.progress.totalSteps > 0
                                    ? Math.round((event.progress.completedSteps / event.progress.totalSteps) * 100)
                                    : 0,
                              })}
                            </p>
                          ) : null}
                          {event.details ? (
                            <pre className="overflow-x-auto rounded-lg bg-muted/40 p-4 text-xs text-foreground">
                              {formatStructuredValue(event.details)}
                            </pre>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>{formatDateTime(event.createdAt)}</p>
                          <p>{t('monitoring.jobs.labels.attempts', { current: event.attempts, max: job.maxAttempts })}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
};
