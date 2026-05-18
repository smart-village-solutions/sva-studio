import type { StudioJobResponse, WasteManagementHistoryOverview } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementOperationsContract } from '@sva/plugin-sdk';
import { useState } from 'react';
import { Badge, Button, StudioEmptyState, StudioJobSummaryCard } from '@sva/studio-ui-react';

import { formatUpdatedAt, toJobStatusTone } from './waste-management.page.support.js';

const activeImportStatuses = new Set(['queued', 'running', 'retrying']);

const isActiveImportJob = (
  job: StudioJobResponse['data'] | null
): job is StudioJobResponse['data'] =>
  job?.jobTypeId === wasteManagementOperationsContract.jobTypeIds.importData &&
  activeImportStatuses.has(job.status);

const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const readStructuredRowProgress = (
  job: StudioJobResponse['data']
): {
  readonly processedRows: number;
  readonly totalRows: number;
} | null => {
  const details = job.progress?.details;
  if (!details || typeof details !== 'object') {
    return null;
  }

  const processedRows = details.processedRows;
  const totalRows = details.totalRows;
  if (typeof processedRows !== 'number' || typeof totalRows !== 'number') {
    return null;
  }

  return {
    processedRows,
    totalRows,
  };
};

const resolveImportProgressPercentage = (job: StudioJobResponse['data']) => {
  const structuredProgress = readStructuredRowProgress(job);
  const completedSteps = structuredProgress?.processedRows ?? job.progress?.completedSteps ?? 0;
  const totalSteps = structuredProgress?.totalRows ?? job.progress?.totalSteps ?? 0;

  if (totalSteps <= 0) {
    return job.status === 'queued' ? 0 : 0;
  }

  return clampPercentage((completedSteps / totalSteps) * 100);
};

const resolveImportProgressMessageKey = (job: StudioJobResponse['data']) => {
  if (job.progress?.currentStepLabel) {
    return job.progress.currentStepLabel;
  }

  if (job.progress?.currentStepKey) {
    return `tools.progress.steps.${job.progress.currentStepKey}`;
  }

  return `tools.progress.statuses.${job.status}`;
};

const resolveImportProgressPhaseKey = (job: StudioJobResponse['data']) =>
  job.progress?.currentPhase ? `tools.progress.phases.${job.progress.currentPhase}` : `tools.progress.statuses.${job.status}`;

const resolveImportProgressRows = (job: StudioJobResponse['data']) => {
  const structuredProgress = readStructuredRowProgress(job);
  const processedRows = structuredProgress?.processedRows ?? job.progress?.completedSteps;
  const totalRows = structuredProgress?.totalRows ?? job.progress?.totalSteps;

  if (typeof processedRows !== 'number' || typeof totalRows !== 'number') {
    return null;
  }

  return {
    processedRows,
    totalRows,
  };
};

const WasteToolsActiveImportProgress = ({
  job,
}: {
  readonly job: StudioJobResponse['data'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const progressPercentage = resolveImportProgressPercentage(job);
  const progressMessageKey = resolveImportProgressMessageKey(job);
  const progressPhaseKey = resolveImportProgressPhaseKey(job);
  const rowProgress = resolveImportProgressRows(job);

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-50/90 via-background to-orange-50/70 p-4 shadow-sm shadow-amber-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/80">
            {pt('tools.progress.title')}
          </p>
          <p className="text-sm font-semibold text-foreground">{pt(progressMessageKey)}</p>
          <p className="text-sm text-muted-foreground">{pt(progressPhaseKey)}</p>
        </div>
        <div className="rounded-full border border-amber-500/20 bg-background/80 px-3 py-1 text-sm font-semibold text-foreground">
          {pt('tools.progress.percentage', { value: progressPercentage })}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div
          role="progressbar"
          aria-label={pt('tools.progress.title')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercentage}
          className="h-3 overflow-hidden rounded-full bg-amber-100/80"
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-[width] duration-500 ${
              job.status === 'running' ? 'animate-pulse' : ''
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {rowProgress
              ? pt('tools.progress.rows', {
                  processed: rowProgress.processedRows,
                  total: rowProgress.totalRows,
                })
              : pt(progressMessageKey)}
          </span>
          {job.progress?.lastUpdatedAt ? (
            <span>{pt('tools.progress.updatedAt', { value: formatUpdatedAt(job.progress.lastUpdatedAt) })}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export const WasteToolsHistory = ({
  lastJob,
  technicalHistory,
  canDeleteHistoryEntries = false,
  onDeleteEntry,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly technicalHistory: readonly WasteManagementHistoryOverview['technical']['items'][number][];
  readonly canDeleteHistoryEntries?: boolean;
  readonly onDeleteEntry?: (jobId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <StudioJobSummaryCard
        title={pt('tools.meta.lastJobTitle')}
        description={lastJob ? pt('tools.meta.lastJobDescription') : pt('tools.meta.noJobYet')}
        statusLabel={lastJob?.status ?? pt('tools.meta.noJobStatus')}
        statusTone={toJobStatusTone(lastJob?.status)}
        metadata={
          lastJob
            ? [
                { id: 'jobId', label: pt('tools.meta.jobIdLabel'), value: lastJob.id },
                { id: 'jobTypeId', label: pt('tools.meta.jobTypeLabel'), value: lastJob.jobTypeId },
                { id: 'jobStatus', label: pt('tools.meta.jobStatusLabel'), value: lastJob.status },
              ]
            : undefined
        }
        emptyState={pt('tools.meta.noJobYet')}
      />
      {isActiveImportJob(lastJob) ? <WasteToolsActiveImportProgress job={lastJob} /> : null}
      <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('tools.meta.historyTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('tools.meta.historyDescription')}</p>
        </div>
        {technicalHistory.length ? (
          <div className="space-y-2">
            {technicalHistory.slice(0, 5).map((item) => {
              const isOpen = openEntryId === item.id;
              const jobId = item.jobId ?? undefined;
              return (
                <div key={item.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{item.eventType}</Badge>
                        <Badge
                          variant={
                            item.outcome === 'success'
                              ? 'default'
                              : item.outcome === 'failure'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {pt(`overview.outcome.${item.outcome}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}
                      </p>
                      {item.message ? <p className="text-sm text-foreground">{item.message}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpenEntryId(isOpen ? null : item.id)}
                      >
                        {pt('tools.meta.historyDetailsAction')}
                      </Button>
                      {jobId && canDeleteHistoryEntries ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onDeleteEntry?.(jobId)}
                        >
                          {pt('tools.meta.historyDeleteAction')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm text-muted-foreground">
                      {jobId ? <p>{pt('overview.meta.jobId', { value: jobId })}</p> : null}
                      {item.jobTypeId ? <p>{pt('overview.meta.jobTypeId', { value: item.jobTypeId })}</p> : null}
                      {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
                      {item.errorCode ? <p>{pt('overview.meta.reasonCode', { value: item.errorCode })}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <StudioEmptyState>{pt('tools.meta.noTechnicalHistory')}</StudioEmptyState>
        )}
      </div>
    </div>
  );
};
