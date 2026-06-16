import type { StudioJobDetail, StudioJobListItem, StudioJobProgress } from '@sva/core';

import { getActiveLocale, t } from '../../i18n';
import { formatTechnicalEditorDateTime } from '../../lib/editor-date-time';

type MonitoringJobStatus = StudioJobListItem['status'];
type MonitoringJobStaleState = NonNullable<StudioJobDetail['runtime']>['staleState'];

export const monitoringJobStatusVariantByValue: Record<
  MonitoringJobStatus,
  'outline' | 'secondary' | 'default' | 'destructive'
> = {
  queued: 'outline',
  running: 'secondary',
  retrying: 'secondary',
  succeeded: 'default',
  failed: 'destructive',
  cancelled: 'destructive',
};

export const monitoringJobStatusLabelKeyByValue: Record<MonitoringJobStatus, string> = {
  queued: 'monitoring.jobs.status.queued',
  running: 'monitoring.jobs.status.running',
  retrying: 'monitoring.jobs.status.retrying',
  succeeded: 'monitoring.jobs.status.succeeded',
  failed: 'monitoring.jobs.status.failed',
  cancelled: 'monitoring.jobs.status.cancelled',
};

export const monitoringJobStaleStateLabelKeyByValue: Record<MonitoringJobStaleState, string> = {
  fresh: 'monitoring.jobs.runtime.fresh',
  stale: 'monitoring.jobs.runtime.stale',
  terminal: 'monitoring.jobs.runtime.terminal',
};

export const formatMonitoringJobDateTime = (value?: string): string => {
  if (!value) {
    return t('monitoring.jobs.values.notAvailable');
  }
  return formatTechnicalEditorDateTime(value) ?? value;
};

export const formatMonitoringJobProgressSummary = (progress?: StudioJobProgress): string => {
  if (!progress) {
    return t('monitoring.jobs.values.notAvailable');
  }

  const percent = progress.totalSteps > 0 ? Math.round((progress.completedSteps / progress.totalSteps) * 100) : 0;
  return t('monitoring.jobs.progress.summary', {
    current: progress.completedSteps,
    total: progress.totalSteps,
    percent,
  });
};

const monitoringWasteStepLabelKeyByValue = {
  'load-studio-state': 'monitoring.jobs.progress.stepLabels.loadStudioState',
  'load-mainserver-snapshot': 'monitoring.jobs.progress.stepLabels.loadMainserverSnapshot',
  'diff-sync-state': 'monitoring.jobs.progress.stepLabels.diffSyncState',
  'complete-operation': 'monitoring.jobs.progress.stepLabels.completeOperation',
} as const;

type MonitoringJobWriteSummary = {
  readonly writtenCount: number;
  readonly createBatchCount?: number;
  readonly deletedCount: number;
  readonly deletedByIdCount?: number;
  readonly deletedByValueCount?: number;
  readonly studioCount: number;
  readonly mainserverCount: number;
  readonly errorCount: number;
};

type MonitoringWasteLiveProgress = Readonly<{
  operationMode: 'create' | 'delete';
  totalItemCount: number;
  totalBatchCount: number;
  currentBatchIndex: number;
  currentBatchSize: number;
  processedItemCount: number;
  createCount: number;
  deleteCount: number;
  lastSuccessfulBatchAt?: string;
  lastBatchDurationMs?: number;
  averageBatchDurationMs?: number;
}>;

type MonitoringWasteStepKey = keyof typeof monitoringWasteStepLabelKeyByValue;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const toMonitoringNumberLocale = (): string => (getActiveLocale() === 'en' ? 'en-US' : 'de-DE');

export const formatMonitoringInteger = (value: number): string =>
  new Intl.NumberFormat(toMonitoringNumberLocale()).format(value);

const resolveMonitoringWasteLiveProgressFromProgress = (progress?: StudioJobProgress): MonitoringWasteLiveProgress | null => {
  const details = progress?.details;
  if (!isRecord(details)) {
    return null;
  }

  const operationMode = details.operationMode;
  if (operationMode !== 'create' && operationMode !== 'delete') {
    return null;
  }

  const totalItemCount = readNumber(details, 'totalItemCount');
  const totalBatchCount = readNumber(details, 'totalBatchCount');
  const currentBatchIndex = readNumber(details, 'currentBatchIndex');
  const currentBatchSize = readNumber(details, 'currentBatchSize');
  const processedItemCount = readNumber(details, 'processedItemCount');
  const createCount = readNumber(details, 'createCount');
  const deleteCount = readNumber(details, 'deleteCount');

  if (
    totalItemCount === null ||
    totalBatchCount === null ||
    currentBatchIndex === null ||
    currentBatchSize === null ||
    processedItemCount === null ||
    createCount === null ||
    deleteCount === null
  ) {
    return null;
  }

  return {
    operationMode,
    totalItemCount,
    totalBatchCount,
    currentBatchIndex,
    currentBatchSize,
    processedItemCount,
    createCount,
    deleteCount,
    lastSuccessfulBatchAt: typeof details.lastSuccessfulBatchAt === 'string' ? details.lastSuccessfulBatchAt : undefined,
    lastBatchDurationMs: readNumber(details, 'lastBatchDurationMs') ?? undefined,
    averageBatchDurationMs: readNumber(details, 'averageBatchDurationMs') ?? undefined,
  };
};

const isMonitoringWasteStepKey = (value: string): value is MonitoringWasteStepKey => value in monitoringWasteStepLabelKeyByValue;

export const resolveMonitoringJobStepLabel = (progress?: StudioJobProgress): string | null => {
  if (!progress) {
    return null;
  }

  if (progress.currentStepKey === 'create-batches' || progress.currentStepKey === 'delete-batches') {
    return formatMonitoringWasteLiveProgressSummary(resolveMonitoringWasteLiveProgressFromProgress(progress));
  }

  if (progress.currentStepKey && isMonitoringWasteStepKey(progress.currentStepKey)) {
    return t(monitoringWasteStepLabelKeyByValue[progress.currentStepKey]);
  }

  return progress.currentStepLabel ?? progress.currentStepKey ?? null;
};

export const getMonitoringJobCurrentStep = (progress?: StudioJobProgress): string =>
  resolveMonitoringJobStepLabel(progress) ?? t('monitoring.jobs.values.notAvailable');

export const extractMonitoringWasteLiveProgress = (
  job: Pick<StudioJobDetail, 'jobTypeId' | 'progress' | 'runtime'> | Pick<StudioJobListItem, 'jobTypeId' | 'progress' | 'runtime'>
): MonitoringWasteLiveProgress | null => {
  if (job.jobTypeId !== 'waste-management.sync-mainserver') {
    return null;
  }
  return resolveMonitoringWasteLiveProgressFromProgress(job.progress);
};

export const formatMonitoringWasteLiveProgressSummary = (progress: MonitoringWasteLiveProgress | null): string | null => {
  if (!progress) {
    return null;
  }

  return t(
    progress.operationMode === 'create'
      ? 'monitoring.jobs.progress.liveBatchSummaryCreate'
      : 'monitoring.jobs.progress.liveBatchSummaryDelete',
    {
      current: progress.totalBatchCount > 0 ? progress.currentBatchIndex : 1,
      total: progress.totalBatchCount > 0 ? progress.totalBatchCount : 1,
    }
  );
};

export const formatMonitoringWasteLiveProgressSecondary = (progress: MonitoringWasteLiveProgress | null): string | null => {
  if (!progress) {
    return null;
  }

  return t('monitoring.jobs.progress.liveProcessedSummary', {
    current: formatMonitoringInteger(progress.processedItemCount),
    total: formatMonitoringInteger(progress.totalItemCount),
  });
};

export const getMonitoringWasteLikelyStuckHint = (
  job: Pick<StudioJobDetail, 'jobTypeId' | 'progress' | 'runtime'>
): string | null => {
  const liveProgress = extractMonitoringWasteLiveProgress(job);
  if (!liveProgress || job.runtime?.staleState !== 'stale') {
    return null;
  }

  return t('monitoring.jobs.detail.liveProgressLikelyStuck');
};

export const extractMonitoringJobWriteSummary = (job: Pick<StudioJobDetail, 'jobTypeId' | 'resultPayload'>): MonitoringJobWriteSummary | null => {
  if (!isRecord(job.resultPayload)) {
    return null;
  }

  const plugin = job.resultPayload.plugin;
  if (!isRecord(plugin)) {
    return null;
  }

  const operation = plugin.operation;
  if (job.jobTypeId !== 'waste-management.sync-mainserver' || operation !== 'sync-mainserver') {
    return null;
  }

  const createCount = readNumber(plugin, 'createCount');
  const createBatchCount = readNumber(plugin, 'createBatchCount');
  const deleteCount = readNumber(plugin, 'deleteCount');
  const deleteByIdCount = readNumber(plugin, 'deleteByIdCount');
  const deleteByValueCount = readNumber(plugin, 'deleteByValueCount');
  const studioItemCount = readNumber(plugin, 'studioItemCount');
  const mainserverItemCount = readNumber(plugin, 'mainserverItemCount');
  const errorCount = readNumber(plugin, 'errorCount');

  if (
    createCount === null ||
    deleteCount === null ||
    studioItemCount === null ||
    mainserverItemCount === null ||
    errorCount === null
  ) {
    return null;
  }

  return {
    writtenCount: createCount,
    ...(createBatchCount === null ? {} : { createBatchCount }),
    deletedCount: deleteCount,
    ...(deleteByIdCount === null ? {} : { deletedByIdCount: deleteByIdCount }),
    ...(deleteByValueCount === null ? {} : { deletedByValueCount: deleteByValueCount }),
    studioCount: studioItemCount,
    mainserverCount: mainserverItemCount,
    errorCount,
  };
};
