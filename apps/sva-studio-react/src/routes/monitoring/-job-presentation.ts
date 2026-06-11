import type { StudioJobDetail, StudioJobListItem, StudioJobProgress } from '@sva/core';

import { t } from '../../i18n';
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

export const getMonitoringJobCurrentStep = (progress?: StudioJobProgress): string =>
  progress?.currentStepLabel ?? progress?.currentStepKey ?? t('monitoring.jobs.values.notAvailable');

type MonitoringJobWriteSummary = {
  readonly writtenCount: number;
  readonly deletedCount: number;
  readonly studioCount: number;
  readonly mainserverCount: number;
  readonly errorCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  if (job.jobTypeId !== 'waste-management.sync-mainserver' && operation !== 'sync-mainserver') {
    return null;
  }

  const createCount = readNumber(plugin, 'createCount');
  const deleteCount = readNumber(plugin, 'deleteCount');
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
    deletedCount: deleteCount,
    studioCount: studioItemCount,
    mainserverCount: mainserverItemCount,
    errorCount,
  };
};
