import { describe, expect, it } from 'vitest';

import {
  createStudioJobEventPresentation,
  createStudioJobRuntimeDiagnostics,
  normalizeStudioJobDetail,
  normalizeStudioJobEventDetails,
  resolveLatestStudioJobEvent,
  resolveStudioJobLastObservedAt,
} from './job-detail-read-model.js';

describe('job detail read model', () => {
  it('computes runtime diagnostics and exposes the latest event for polling UIs', () => {
    const detail = normalizeStudioJobDetail(
      {
        id: 'job-1',
        instanceId: 'tenant-a',
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        queueName: 'plugin-operations',
        status: 'running',
        progress: {
          completedSteps: 1,
          totalSteps: 3,
          currentPhase: 'mapping',
        },
        inputPayload: { source: 'upload-1' },
        attempts: 1,
        maxAttempts: 5,
        idempotencyKey: 'idem-1',
        workerId: 'graphile-worker:tenant-a:job-1',
        heartbeatAt: '2026-05-09T12:01:00.000Z',
        lastProgressAt: '2026-05-09T12:00:30.000Z',
        cancelRequestedAt: '2026-05-09T12:01:15.000Z',
        scheduledAt: '2026-05-09T12:00:00.000Z',
        startedAt: '2026-05-09T12:00:10.000Z',
        createdAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:01:00.000Z',
        history: [
          {
            id: 'event-1',
            jobId: 'job-1',
            instanceId: 'tenant-a',
            eventType: 'job.started',
            status: 'running',
            attempts: 1,
            createdAt: '2026-05-09T12:00:10.000Z',
          },
          {
            id: 'event-2',
            jobId: 'job-1',
            instanceId: 'tenant-a',
            eventType: 'job.progressed',
            status: 'running',
            attempts: 1,
            createdAt: '2026-05-09T12:01:00.000Z',
            details: {
              host: {
                workerId: 'graphile-worker:tenant-a:job-1',
              },
            },
          },
        ],
      },
      {
        now: () => '2026-05-09T12:05:00.000Z',
        staleAfterSeconds: 120,
      }
    );

    expect(detail.latestEvent?.id).toBe('event-2');
    expect(detail.latestEvent?.message).toBeUndefined();
    expect(detail.history[0]?.presentation).toEqual({
      tone: 'info',
      title: 'job.started',
      isTerminal: false,
    });
    expect(detail.history[1]?.details).toEqual({
      host: {
        workerId: 'graphile-worker:tenant-a:job-1',
      },
    });
    expect(detail.runtime).toEqual({
      cancellationRequested: true,
      staleState: 'stale',
      staleAfterSeconds: 120,
      evaluatedAt: '2026-05-09T12:05:00.000Z',
      lastObservedAt: '2026-05-09T12:01:00.000Z',
    });
  });

  it('covers event presentation and default messages for every event type', () => {
    expect(createStudioJobEventPresentation({ eventType: 'job.queued' } as never)).toEqual({
      tone: 'info',
      title: 'job.queued',
      isTerminal: false,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.started' } as never)).toEqual({
      tone: 'info',
      title: 'job.started',
      isTerminal: false,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.progressed' } as never)).toEqual({
      tone: 'neutral',
      title: 'job.progressed',
      isTerminal: false,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.retrying' } as never)).toEqual({
      tone: 'warning',
      title: 'job.retrying',
      isTerminal: false,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.succeeded' } as never)).toEqual({
      tone: 'success',
      title: 'job.succeeded',
      isTerminal: true,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.failed' } as never)).toEqual({
      tone: 'error',
      title: 'job.failed',
      isTerminal: true,
    });
    expect(createStudioJobEventPresentation({ eventType: 'job.cancelled' } as never)).toEqual({
      tone: 'warning',
      title: 'job.cancelled',
      isTerminal: true,
    });
  });

  it('derives event details and runtime states across host, plugin and stale-state variants', () => {
    expect(
      normalizeStudioJobEventDetails(
        {
          workerId: 'worker-1',
          errorPayload: { code: 'ERR', category: 'transient' } as never,
          cancelRequestedAt: '2026-05-09T12:02:00.000Z',
        },
        {
          eventType: 'job.failed',
          details: { plugin: { key: 'value' } },
        } as never
      )
    ).toEqual({
      host: {
        workerId: 'worker-1',
        errorCode: 'ERR',
        errorCategory: 'transient',
      },
      plugin: { key: 'value' },
    });

    expect(
      normalizeStudioJobEventDetails(
        {
          workerId: 'worker-1',
          errorPayload: undefined,
          cancelRequestedAt: '2026-05-09T12:02:00.000Z',
        },
        {
          eventType: 'job.cancelled',
          details: {},
        } as never
      )
    ).toEqual({
      host: {
        workerId: 'worker-1',
        cancellationRequestedAt: '2026-05-09T12:02:00.000Z',
      },
    });

    expect(normalizeStudioJobEventDetails({ workerId: undefined, errorPayload: undefined, cancelRequestedAt: undefined }, {
      eventType: 'job.started',
    } as never)).toBeUndefined();

    expect(
      createStudioJobRuntimeDiagnostics(
        {
          status: 'succeeded',
          heartbeatAt: undefined,
          lastProgressAt: undefined,
          startedAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:00:10.000Z',
          cancelRequestedAt: undefined,
        } as never,
        { now: () => '2026-05-09T12:10:00.000Z' }
      )
    ).toMatchObject({ staleState: 'terminal', cancellationRequested: false });

    expect(
      createStudioJobRuntimeDiagnostics(
        {
          status: 'running',
          heartbeatAt: '2026-05-09T12:09:30.000Z',
          lastProgressAt: undefined,
          startedAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:09:30.000Z',
          cancelRequestedAt: undefined,
        } as never,
        { now: () => '2026-05-09T12:10:00.000Z', staleAfterSeconds: 120 }
      )
    ).toMatchObject({ staleState: 'fresh', lastObservedAt: '2026-05-09T12:09:30.000Z' });
  });

  it('resolves latest events and last observed timestamps defensively', () => {
    expect(resolveLatestStudioJobEvent([])).toBeUndefined();
    expect(
      resolveLatestStudioJobEvent([
        { id: 'event-1' },
        { id: 'event-2' },
      ] as never)
    ).toMatchObject({ id: 'event-2' });

    expect(
      resolveStudioJobLastObservedAt({
        heartbeatAt: undefined,
        lastProgressAt: '2026-05-09T12:03:00.000Z',
        startedAt: '2026-05-09T12:01:00.000Z',
        updatedAt: '2026-05-09T12:04:00.000Z',
      } as never)
    ).toBe('2026-05-09T12:03:00.000Z');
    expect(
      resolveStudioJobLastObservedAt({
        heartbeatAt: undefined,
        lastProgressAt: undefined,
        startedAt: undefined,
        updatedAt: '2026-05-09T12:04:00.000Z',
      } as never)
    ).toBe('2026-05-09T12:04:00.000Z');
  });
});
