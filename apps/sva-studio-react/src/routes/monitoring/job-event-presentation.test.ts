import { describe, expect, it } from 'vitest';

import type { StudioJobEventRecord } from '@sva/core';

import {
  formatMonitoringJobEventMessage,
  formatMonitoringJobEventTitle,
  resolveMonitoringJobEventIsTerminal,
  resolveMonitoringJobEventTone,
} from './job-event-presentation';

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
});
