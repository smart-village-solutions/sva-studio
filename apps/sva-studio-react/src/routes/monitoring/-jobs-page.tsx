import type { StudioJobListItem } from '@sva/core';
import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { usePluginOperationJobs } from '../../hooks/use-plugin-operation-jobs';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
import { formatMonitoringJobEventMessage, formatMonitoringJobEventTitle } from './-job-event-presentation';
import {
  extractMonitoringWasteLiveProgress,
  formatMonitoringJobDateTime,
  formatMonitoringJobProgressSummary,
  formatMonitoringWasteLiveProgressSecondary,
  formatMonitoringWasteLiveProgressSummary,
  getMonitoringJobCurrentStep,
  monitoringJobStaleStateLabelKeyByValue,
  monitoringJobStatusLabelKeyByValue,
  monitoringJobStatusVariantByValue,
} from './-job-presentation';

type MonitoringJobsView = 'active' | 'history';
type MonitoringJobsStatusFilter = 'all' | StudioJobListItem['status'];

const monitoringStatusFilters = ['all', 'queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled'] as const;

const staleVariantByValue = {
  fresh: 'outline',
  stale: 'destructive',
  terminal: 'default',
} as const;

const jobsErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('monitoring.jobs.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('monitoring.jobs.errors.forbidden');
    case 'database_unavailable':
      return t('monitoring.jobs.errors.databaseUnavailable');
    default:
      return t('monitoring.jobs.messages.loadError');
  }
};

const JobsPaginationNav = ({
  page,
  pageCount,
  onPageChange,
}: Readonly<{
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}>) => (
  <nav
    aria-label={t('monitoring.jobs.pagination.ariaLabel')}
    className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
  >
    <p aria-live="polite">{t('monitoring.jobs.pagination.pageLabel', { page, total: pageCount })}</p>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t('monitoring.jobs.pagination.previous')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t('monitoring.jobs.pagination.next')}
      </Button>
    </div>
  </nav>
);

export const MonitoringJobsPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const [view, setView] = React.useState<MonitoringJobsView>('active');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<MonitoringJobsStatusFilter>('all');
  const [pluginId, setPluginId] = React.useState('');
  const [jobTypeId, setJobTypeId] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const jobsApi = usePluginOperationJobs({
    view,
    page,
    pageSize,
    ...(status !== 'all' ? { status } : {}),
    ...(pluginId.trim().length > 0 ? { pluginId: pluginId.trim() } : {}),
    ...(jobTypeId.trim().length > 0 ? { jobTypeId: jobTypeId.trim() } : {}),
    ...(search.trim().length > 0 ? { q: search.trim() } : {}),
  });

  const totalPages = Math.max(1, Math.ceil(jobsApi.total / pageSize));

  const columns = React.useMemo<readonly StudioColumnDef<StudioJobListItem>[]>(
    () => [
      {
        id: 'status',
        header: t('monitoring.jobs.table.status'),
        cell: (job) => (
          <div className="space-y-2">
            <Badge variant={monitoringJobStatusVariantByValue[job.status]}>
              {t(monitoringJobStatusLabelKeyByValue[job.status])}
            </Badge>
            <div>
              <Badge variant={staleVariantByValue[job.runtime.staleState]}>
                {t(monitoringJobStaleStateLabelKeyByValue[job.runtime.staleState])}
              </Badge>
            </div>
          </div>
        ),
      },
      {
        id: 'job',
        header: t('monitoring.jobs.table.job'),
        cell: (job) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{job.jobTypeId}</p>
            <p className="text-xs text-muted-foreground">{job.pluginId}</p>
            <p className="text-xs text-muted-foreground">{job.id}</p>
          </div>
        ),
      },
      {
        id: 'progress',
        header: t('monitoring.jobs.table.progress'),
        cell: (job) => (
          (() => {
            const liveProgress = extractMonitoringWasteLiveProgress(job);
            const primaryProgress = formatMonitoringWasteLiveProgressSummary(liveProgress) ?? formatMonitoringJobProgressSummary(job.progress);
            const secondaryProgress = formatMonitoringWasteLiveProgressSecondary(liveProgress) ?? getMonitoringJobCurrentStep(job.progress);

            return (
              <div className="space-y-1">
                <p>{primaryProgress}</p>
                <p className="text-xs text-muted-foreground">{secondaryProgress}</p>
              </div>
            );
          })()
        ),
      },
      {
        id: 'latestEvent',
        header: t('monitoring.jobs.table.latestEvent'),
        cell: (job) => (
          <div className="space-y-1">
            <p>{job.latestEvent ? formatMonitoringJobEventTitle(job.latestEvent) : t('monitoring.jobs.values.notAvailable')}</p>
            <p className="text-xs text-muted-foreground">
              {job.latestEvent ? formatMonitoringJobEventMessage(job.latestEvent) : t('monitoring.jobs.values.notAvailable')}
            </p>
          </div>
        ),
      },
      {
        id: 'timestamps',
        header: t('monitoring.jobs.table.timestamps'),
        cell: (job) => (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t('monitoring.jobs.labels.startedAt', { value: formatMonitoringJobDateTime(job.startedAt) })}</p>
            <p>
              {t('monitoring.jobs.labels.lastObservedAt', {
                value: formatMonitoringJobDateTime(job.runtime.lastObservedAt),
              })}
            </p>
            <p>{t('monitoring.jobs.labels.finishedAt', { value: formatMonitoringJobDateTime(job.finishedAt) })}</p>
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('monitoring.jobs.table.actions'),
        cell: (job) => (
          <Button asChild size="sm" variant="outline">
            <Link to="/monitoring/jobs/$jobId" params={{ jobId: job.id }}>
              {t('monitoring.jobs.actions.open')}
            </Link>
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <StudioListPageTemplate
      title={t('monitoring.jobs.page.title')}
      description={t('monitoring.jobs.page.subtitle')}
      primaryAction={{
        label: t('monitoring.jobs.actions.refresh'),
        render: (
          <Button type="button" variant="outline" onClick={() => void jobsApi.refetch()}>
            {t('monitoring.jobs.actions.refresh')}
          </Button>
        ),
      }}
    >
      <div className="space-y-4">
        {jobsApi.error ? (
          <Alert className="border-destructive/40 text-destructive">
            <AlertDescription>{jobsErrorMessage(jobsApi.error)}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={view}
          onValueChange={(nextValue) => {
            setView(nextValue === 'history' ? 'history' : 'active');
            setPage(1);
          }}
        >
          <TabsList aria-label={t('monitoring.jobs.tabs.ariaLabel')} className="h-auto flex-wrap justify-start">
            <TabsTrigger value="active">{t('monitoring.jobs.tabs.active')}</TabsTrigger>
            <TabsTrigger value="history">{t('monitoring.jobs.tabs.history')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="monitoring-job-search">{t('monitoring.jobs.filters.searchLabel')}</Label>
            <Input
              id="monitoring-job-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('monitoring.jobs.filters.searchPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monitoring-job-status">{t('monitoring.jobs.filters.statusLabel')}</Label>
            <Select
              id="monitoring-job-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as MonitoringJobsStatusFilter);
                setPage(1);
              }}
            >
              {monitoringStatusFilters.map((value) => (
                <option key={value} value={value}>
                  {value === 'all'
                    ? t('monitoring.jobs.filters.statusAll')
                    : t(monitoringJobStatusLabelKeyByValue[value])}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monitoring-job-plugin">{t('monitoring.jobs.filters.pluginLabel')}</Label>
            <Input
              id="monitoring-job-plugin"
              value={pluginId}
              onChange={(event) => {
                setPluginId(event.target.value);
                setPage(1);
              }}
              placeholder={t('monitoring.jobs.filters.pluginPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monitoring-job-type">{t('monitoring.jobs.filters.jobTypeLabel')}</Label>
            <Input
              id="monitoring-job-type"
              value={jobTypeId}
              onChange={(event) => {
                setJobTypeId(event.target.value);
                setPage(1);
              }}
              placeholder={t('monitoring.jobs.filters.jobTypePlaceholder')}
            />
          </div>
        </div>

        <StudioDataTable
          ariaLabel={t('monitoring.jobs.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('monitoring.jobs.table.caption')}
          columns={columns}
          data={jobsApi.items}
          emptyState={<p className="text-sm text-muted-foreground">{t('monitoring.jobs.empty.body')}</p>}
          getRowId={(job) => job.id}
          isLoading={jobsApi.isLoading}
          loadingState={t('monitoring.jobs.messages.loading')}
          selectionMode="none"
        />

        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Label htmlFor="monitoring-job-page-size">{t('monitoring.jobs.pagination.pageSizeLabel')}</Label>
            <Select
              id="monitoring-job-page-size"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50].map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <JobsPaginationNav page={page} pageCount={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </StudioListPageTemplate>
  );
};
