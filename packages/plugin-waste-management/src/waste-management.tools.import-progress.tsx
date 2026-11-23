import { usePluginTranslation, type StudioJobResponse } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';

import { formatUpdatedAt } from './waste-management.page.support.js';

const activeImportStatuses = new Set(['queued', 'running', 'retrying']);
export const isActiveImportJob = (
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
    return 0;
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
  job.progress?.currentPhase
    ? `tools.progress.phases.${job.progress.currentPhase}`
    : `tools.progress.statuses.${job.status}`;

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

export const WasteToolsActiveImportProgress = ({
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
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-status-warning-foreground">
            {pt('tools.progress.title')}
          </p>
          <p className="text-sm font-semibold text-foreground">{pt(progressMessageKey)}</p>
          <p className="text-sm text-muted-foreground">{pt(progressPhaseKey)}</p>
        </div>
        <div className="rounded-full border border-border-subtle bg-card px-3 py-1 text-sm font-semibold text-foreground">
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
          className="h-3 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full bg-primary transition-[width] duration-500 ${
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
            <span>
              {pt('tools.progress.updatedAt', {
                value: formatUpdatedAt(job.progress.lastUpdatedAt),
              })}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
};
