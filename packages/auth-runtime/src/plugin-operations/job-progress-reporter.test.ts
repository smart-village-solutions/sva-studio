import { describe, expect, it, vi } from 'vitest';

import { createJobProgressReporter } from './job-progress-reporter.js';

describe('job progress reporter', () => {
  it('persists progress and appends a technical progress event with worker context', async () => {
    const updateJobProgress = vi.fn(async () => null);
    const appendProgressedEvent = vi.fn(async () => null);

    const reporter = createJobProgressReporter({
      job: {
        id: 'job-1',
        instanceId: 'tenant-a',
      },
      attempts: 2,
      workerId: 'graphile-worker:tenant-a:job-1',
      updateJobProgress,
      appendProgressedEvent,
      now: () => '2026-05-09T12:01:00.000Z',
    });

    await reporter.reportProgress({
      jobId: 'job-1',
      instanceId: 'tenant-a',
      progress: {
        completedSteps: 1,
        totalSteps: 3,
        currentPhase: 'mapping',
      },
    });

    expect(updateJobProgress).toHaveBeenCalledWith({
      jobId: 'job-1',
      instanceId: 'tenant-a',
      progress: {
        completedSteps: 1,
        totalSteps: 3,
        currentPhase: 'mapping',
        lastUpdatedAt: '2026-05-09T12:01:00.000Z',
      },
      lastProgressAt: '2026-05-09T12:01:00.000Z',
      heartbeatAt: '2026-05-09T12:01:00.000Z',
    });
    expect(appendProgressedEvent).toHaveBeenCalledWith({
      jobId: 'job-1',
      instanceId: 'tenant-a',
      progress: {
        completedSteps: 1,
        totalSteps: 3,
        currentPhase: 'mapping',
        lastUpdatedAt: '2026-05-09T12:01:00.000Z',
      },
      attempts: 2,
      hostDetails: {
        workerId: 'graphile-worker:tenant-a:job-1',
      },
    });
  });
});
