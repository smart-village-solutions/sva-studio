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
