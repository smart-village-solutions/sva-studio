import type { StudioJobEventRecord } from '@sva/core';

import { t } from '../../i18n';
import { resolveMonitoringJobStepLabel } from './-job-presentation';

const eventTitleKeyByType = {
  'job.queued': 'monitoring.jobs.events.titles.job.queued',
  'job.started': 'monitoring.jobs.events.titles.job.started',
  'job.progressed': 'monitoring.jobs.events.titles.job.progressed',
  'job.retrying': 'monitoring.jobs.events.titles.job.retrying',
  'job.succeeded': 'monitoring.jobs.events.titles.job.succeeded',
  'job.failed': 'monitoring.jobs.events.titles.job.failed',
  'job.cancelled': 'monitoring.jobs.events.titles.job.cancelled',
} as const;

const eventFallbackMessageKeyByType = {
  'job.queued': 'monitoring.jobs.events.messages.job.queued',
  'job.started': 'monitoring.jobs.events.messages.job.started',
  'job.progressed': 'monitoring.jobs.events.messages.job.progressed',
  'job.retrying': 'monitoring.jobs.events.messages.job.retrying',
  'job.succeeded': 'monitoring.jobs.events.messages.job.succeeded',
  'job.failed': 'monitoring.jobs.events.messages.job.failed',
  'job.cancelled': 'monitoring.jobs.events.messages.job.cancelled',
} as const;

const eventToneByType = {
  'job.queued': 'info',
  'job.started': 'info',
  'job.progressed': 'neutral',
  'job.retrying': 'warning',
  'job.succeeded': 'success',
  'job.failed': 'error',
  'job.cancelled': 'warning',
} as const;

const eventTerminalStateByType = {
  'job.queued': false,
  'job.started': false,
  'job.progressed': false,
  'job.retrying': false,
  'job.succeeded': true,
  'job.failed': true,
  'job.cancelled': true,
} as const;

export const formatMonitoringJobEventTitle = (event: StudioJobEventRecord): string =>
  t(eventTitleKeyByType[event.eventType]);

export const formatMonitoringJobEventMessage = (event: StudioJobEventRecord): string | undefined => {
  if (event.eventType === 'job.progressed') {
    const localizedStepLabel = resolveMonitoringJobStepLabel(event.progress);
    if (localizedStepLabel) {
      return t('monitoring.jobs.events.messages.job.progressedStepLabel', {
        value: localizedStepLabel,
      });
    }
  }

  if (event.message) {
    return event.message;
  }

  if (event.eventType === 'job.progressed' && event.progress?.currentStepLabel) {
    return t('monitoring.jobs.events.messages.job.progressedStepLabel', {
      value: event.progress.currentStepLabel,
    });
  }

  if (event.eventType === 'job.progressed' && event.progress?.currentStepKey) {
    return t('monitoring.jobs.events.messages.job.progressedStepKey', {
      value: event.progress.currentStepKey,
    });
  }

  return t(eventFallbackMessageKeyByType[event.eventType]);
};

export const resolveMonitoringJobEventTone = (
  event: StudioJobEventRecord
): 'neutral' | 'info' | 'success' | 'warning' | 'error' =>
  event.presentation?.tone ?? eventToneByType[event.eventType];

export const resolveMonitoringJobEventIsTerminal = (event: StudioJobEventRecord): boolean =>
  event.presentation?.isTerminal ?? eventTerminalStateByType[event.eventType];
