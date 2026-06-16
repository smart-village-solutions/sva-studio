import { afterEach, describe, expect, it } from 'vitest';

import type { StudioJobEventRecord } from '@sva/core';
import type { StudioJobDetail } from '@sva/core';

import { setActiveLocale } from '../../i18n';
import {
  formatMonitoringJobEventMessage,
  formatMonitoringJobEventTitle,
  resolveMonitoringJobEventIsTerminal,
  resolveMonitoringJobEventTone,
} from './-job-event-presentation';
import {
  extractMonitoringJobWriteSummary,
  extractMonitoringWasteLiveProgress,
  formatMonitoringJobDateTime,
  formatMonitoringWasteLiveProgressSecondary,
  formatMonitoringWasteLiveProgressSummary,
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
  afterEach(() => {
    setActiveLocale('de');
  });

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

  it('renders the write summary only for the expected waste mainserver sync job type and operation', () => {
    const job = {
      jobTypeId: 'waste-management.sync-mainserver',
      resultPayload: {
        plugin: {
          operation: 'sync-mainserver',
          createCount: 7,
          createBatchCount: 2,
          deleteCount: 3,
          deleteByIdCount: 2,
          deleteByValueCount: 1,
          studioItemCount: 42,
          mainserverItemCount: 39,
          errorCount: 0,
        },
      },
    } satisfies Pick<StudioJobDetail, 'jobTypeId' | 'resultPayload'>;

    expect(extractMonitoringJobWriteSummary(job)).toEqual({
      writtenCount: 7,
      createBatchCount: 2,
      deletedCount: 3,
      deletedByIdCount: 2,
      deletedByValueCount: 1,
      studioCount: 42,
      mainserverCount: 39,
      errorCount: 0,
    });

    expect(
      extractMonitoringJobWriteSummary({
        ...job,
        resultPayload: {
          plugin: {
            ...job.resultPayload.plugin,
            operation: 'other-operation',
          },
        },
      })
    ).toBeNull();

    expect(
      extractMonitoringJobWriteSummary({
        ...job,
        jobTypeId: 'waste-management.sync-waste-types',
      })
    ).toBeNull();
  });

  it('extracts waste live progress summaries from structured progress details', () => {
    const job = {
      jobTypeId: 'waste-management.sync-mainserver',
      progress: {
        completedSteps: 4,
        totalSteps: 6,
        currentStepKey: 'create-batches',
        currentStepLabel: 'Create-Batches 362/1373',
        details: {
          operationMode: 'create',
          totalItemCount: 137249,
          totalBatchCount: 1373,
          currentBatchIndex: 362,
          currentBatchSize: 100,
          processedItemCount: 36200,
          createCount: 36200,
          deleteCount: 0,
          lastSuccessfulBatchAt: '2026-06-16T10:17:17.125Z',
        },
      },
      runtime: {
        cancellationRequested: false,
        staleAfterSeconds: 120,
        staleState: 'fresh',
        evaluatedAt: '2026-06-16T10:17:17.200Z',
        lastObservedAt: '2026-06-16T10:17:17.125Z',
      },
    } satisfies Pick<StudioJobDetail, 'jobTypeId' | 'progress' | 'runtime'>;

    const liveProgress = extractMonitoringWasteLiveProgress(job);

    expect(liveProgress).toMatchObject({
      operationMode: 'create',
      totalItemCount: 137249,
      totalBatchCount: 1373,
      currentBatchIndex: 362,
      processedItemCount: 36200,
    });
    expect(formatMonitoringWasteLiveProgressSummary(liveProgress)).toBe('Anlegen: Batch 362 / 1373');
    expect(formatMonitoringWasteLiveProgressSecondary(liveProgress)).toBe('36.200 / 137.249 Datensätze verarbeitet');
  });

  it('formats waste live progress with the active locale', () => {
    setActiveLocale('en');

    const job = {
      jobTypeId: 'waste-management.sync-mainserver',
      progress: {
        completedSteps: 4,
        totalSteps: 6,
        currentStepKey: 'create-batches',
        currentStepLabel: 'Create-Batches 362/1373',
        details: {
          operationMode: 'create',
          totalItemCount: 137249,
          totalBatchCount: 1373,
          currentBatchIndex: 362,
          currentBatchSize: 100,
          processedItemCount: 36200,
          createCount: 36200,
          deleteCount: 0,
        },
      },
      runtime: undefined,
    } satisfies Pick<StudioJobDetail, 'jobTypeId' | 'progress' | 'runtime'>;

    const liveProgress = extractMonitoringWasteLiveProgress(job);

    expect(formatMonitoringWasteLiveProgressSummary(liveProgress)).toBe('Create: batch 362 / 1373');
    expect(formatMonitoringWasteLiveProgressSecondary(liveProgress)).toBe('36,200 / 137,249 records processed');
  });
});
