import { describe, expect, it } from 'vitest';

import type { StudioJobEventRecord } from '@sva/core';

import {
  formatMonitoringJobEventMessage,
  formatMonitoringJobEventTitle,
  resolveMonitoringJobEventIsTerminal,
  resolveMonitoringJobEventTone,
} from './-job-event-presentation';
import {
  formatMonitoringJobDateTime,
  formatMonitoringJobProgressSummary,
  getMonitoringJobCurrentStep,
  monitoringJobStaleStateLabelKeyByValue,
  monitoringJobStatusLabelKeyByValue,
  monitoringJobStatusVariantByValue,
} from './-job-presentation';

const baseEvent: StudioJobEventRecord = {
  id: 'event-1',
  jobId: 'job-1',
  instanceId: 'instance-1',
  eventType: 'job.progressed',
  status: 'running',
  attempts: 1,
  createdAt: '2026-05-09T10:00:00.000Z',
};

describe('monitoring job event presentation', () => {
  it('derives localized titles from stable event types', () => {
    expect(formatMonitoringJobEventTitle(baseEvent)).toBe('Fortschritt aktualisiert');
    expect(
      formatMonitoringJobEventTitle({
        ...baseEvent,
        eventType: 'job.failed',
        status: 'failed',
      })
    ).toBe('Job fehlgeschlagen');
  });

  it('keeps explicit event messages and derives fallback progress messages from structured progress data', () => {
    expect(
      formatMonitoringJobEventMessage({
        ...baseEvent,
        message: 'Plugin-spezifische Meldung',
      })
    ).toBe('Plugin-spezifische Meldung');

    expect(
      formatMonitoringJobEventMessage({
        ...baseEvent,
        progress: {
          completedSteps: 1,
          totalSteps: 3,
          currentStepLabel: 'Normalisieren',
        },
      })
    ).toBe('Fortschritt aktualisiert: Normalisieren.');

    expect(
      formatMonitoringJobEventMessage({
        ...baseEvent,
        progress: {
          completedSteps: 1,
          totalSteps: 3,
          currentStepKey: 'normalize',
        },
      })
    ).toBe('Fortschritt aktualisiert: normalize.');
  });

  it('falls back to tone and terminal metadata from the event type when the backend omits presentation details', () => {
    expect(resolveMonitoringJobEventTone(baseEvent)).toBe('neutral');
    expect(resolveMonitoringJobEventIsTerminal(baseEvent)).toBe(false);
    expect(
      resolveMonitoringJobEventTone({
        ...baseEvent,
        eventType: 'job.failed',
        status: 'failed',
      })
    ).toBe('error');
    expect(
      resolveMonitoringJobEventIsTerminal({
        ...baseEvent,
        eventType: 'job.failed',
        status: 'failed',
      })
    ).toBe(true);
  });

  it('provides shared status and progress presentation helpers for monitoring pages', () => {
    expect(monitoringJobStatusVariantByValue.failed).toBe('destructive');
    expect(monitoringJobStatusLabelKeyByValue.running).toBe('monitoring.jobs.status.running');
    expect(monitoringJobStaleStateLabelKeyByValue.terminal).toBe('monitoring.jobs.runtime.terminal');
    expect(formatMonitoringJobDateTime(undefined)).toBe('Nicht verfügbar');
    expect(formatMonitoringJobDateTime('invalid-date')).toBe('invalid-date');
    expect(formatMonitoringJobDateTime('2026-01-15T10:15:00.000Z')).toBe('15.01.2026, 11:15:00,000');
    expect(formatMonitoringJobDateTime('2026-07-15T10:15:00.123Z')).toBe('15.07.2026, 12:15:00,123');
    expect(
      formatMonitoringJobProgressSummary({
        completedSteps: 2,
        totalSteps: 5,
      })
    ).toBe('2 / 5 Schritte (40 %)');
    expect(
      getMonitoringJobCurrentStep({
        completedSteps: 2,
        totalSteps: 5,
        currentStepLabel: 'Normalisieren',
      })
    ).toBe('Normalisieren');
    expect(getMonitoringJobCurrentStep(undefined)).toBe('Nicht verfügbar');
  });
});
