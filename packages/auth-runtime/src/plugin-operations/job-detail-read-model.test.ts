import { describe, expect, it } from 'vitest';

import { normalizeStudioJobDetail } from './job-detail-read-model.js';

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
    expect(detail.latestEvent?.message).toBe('Fortschritt des Jobs wurde aktualisiert.');
    expect(detail.history[0]?.presentation).toEqual({
      tone: 'info',
      title: 'Job gestartet',
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
});
