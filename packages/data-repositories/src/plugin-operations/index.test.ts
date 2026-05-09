import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createStudioJobRepository } from './index.js';

const jobRow = {
  id: 'job-1',
  instance_id: 'tenant-a',
  plugin_id: 'news',
  job_type_id: 'news.import-articles',
  import_profile_id: 'news.article-import',
  queue_name: 'plugin-operations',
  status: 'queued',
  progress: { completedSteps: 0, totalSteps: 3 },
  input_payload: { source: 'upload-1' },
  result_payload: null,
  error_payload: null,
  attempts: 0,
  max_attempts: 5,
  idempotency_key: 'idem-1',
  request_id: 'req-1',
  actor_account_id: 'user-1',
  worker_id: 'worker-a',
  heartbeat_at: '2026-05-09T12:02:00.000Z',
  last_progress_at: '2026-05-09T12:02:00.000Z',
  cancel_requested_at: null,
  correlation_id: 'corr-1',
  parent_job_id: null,
  scheduled_at: '2026-05-09T12:00:00.000Z',
  started_at: null,
  finished_at: null,
  created_at: '2026-05-09T12:00:00.000Z',
  updated_at: '2026-05-09T12:00:00.000Z',
};

const eventRow = {
  id: 'event-1',
  job_id: 'job-1',
  instance_id: 'tenant-a',
  event_type: 'job.progressed',
  status: 'running',
  progress: {
    completedSteps: 1,
    totalSteps: 3,
    currentPhase: 'mapping',
    currentStepKey: 'validate-schema',
    lastUpdatedAt: '2026-05-09T12:03:00.000Z',
  },
  attempts: 1,
  message: 'Schema validiert',
  details: { plugin: { acceptedRows: 10 } },
  created_at: '2026-05-09T12:03:00.000Z',
};

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('studio job repository', () => {
  it('creates and reads central plugin operation jobs', async () => {
    const { executor, statements } = createQueuedExecutor([[jobRow], [jobRow]]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.createJob({
        id: 'job-1',
        instanceId: 'tenant-a',
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        importProfileId: 'news.article-import',
        queueName: 'plugin-operations',
        status: 'queued',
        progress: { completedSteps: 0, totalSteps: 3 },
        inputPayload: { source: 'upload-1' },
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: 'idem-1',
        requestId: 'req-1',
        actorAccountId: 'user-1',
        scheduledAt: '2026-05-09T12:00:00.000Z',
      })
    ).resolves.toMatchObject({
      id: 'job-1',
      pluginId: 'news',
      jobTypeId: 'news.import-articles',
      status: 'queued',
    });

    await expect(repository.getJobById('tenant-a', 'job-1')).resolves.toMatchObject({
      id: 'job-1',
      progress: { completedSteps: 0, totalSteps: 3 },
      requestId: 'req-1',
      workerId: 'worker-a',
      correlationId: 'corr-1',
    });

    expect(statements[0]?.text.includes('INSERT INTO iam.plugin_operation_jobs')).toBe(true);
    expect(statements[1]?.values).toEqual(['tenant-a', 'job-1']);
  });

  it('maps nullable job fields fail-closed and returns null for missing lookups', async () => {
    const sparseRow = {
      ...jobRow,
      import_profile_id: null,
      progress: null,
      result_payload: null,
      error_payload: null,
      request_id: null,
      actor_account_id: null,
      worker_id: null,
      heartbeat_at: null,
      last_progress_at: null,
      cancel_requested_at: null,
      correlation_id: null,
      parent_job_id: null,
      started_at: null,
      finished_at: null,
    };
    const { executor, statements } = createQueuedExecutor([[sparseRow], []]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.createJob({
        id: 'job-2',
        instanceId: 'tenant-a',
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        queueName: 'plugin-operations',
        status: 'queued',
        inputPayload: { source: 'upload-2' },
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: 'idem-2',
        scheduledAt: '2026-05-09T12:00:00.000Z',
      })
    ).resolves.toMatchObject({
      id: 'job-1',
      importProfileId: undefined,
      progress: undefined,
      resultPayload: undefined,
      errorPayload: undefined,
      requestId: undefined,
      actorAccountId: undefined,
      workerId: undefined,
      heartbeatAt: undefined,
      lastProgressAt: undefined,
      cancelRequestedAt: undefined,
      correlationId: undefined,
      parentJobId: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    });

    await expect(repository.getJobById('tenant-a', 'missing')).resolves.toBeNull();
    expect(statements[0]?.values[7]).toBeNull();
  });

  it('updates job execution status, progress, results and errors', async () => {
    const { executor, statements } = createQueuedExecutor([[jobRow]]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.updateJobState({
        jobId: 'job-1',
        instanceId: 'tenant-a',
        status: 'running',
        progress: {
          completedSteps: 1,
          totalSteps: 3,
          currentPhase: 'mapping',
          currentStepKey: 'validate-schema',
          lastUpdatedAt: '2026-05-09T12:01:00.000Z',
        },
        attempts: 1,
        startedAt: '2026-05-09T12:01:00.000Z',
        resultPayload: { summary: { acceptedItems: 0 }, plugin: { acceptedRows: 0 } },
        errorPayload: { code: 'validation_failed', category: 'validation' },
        workerId: 'worker-a',
        heartbeatAt: '2026-05-09T12:01:30.000Z',
      })
    ).resolves.toMatchObject({
      id: 'job-1',
      status: 'queued',
    });

    expect(statements[0]?.text.includes('UPDATE iam.plugin_operation_jobs')).toBe(true);
    expect(statements[0]?.values).toEqual([
      'running',
      JSON.stringify({
        completedSteps: 1,
        totalSteps: 3,
        currentPhase: 'mapping',
        currentStepKey: 'validate-schema',
        lastUpdatedAt: '2026-05-09T12:01:00.000Z',
      }),
      1,
      '2026-05-09T12:01:00.000Z',
      null,
      JSON.stringify({ summary: { acceptedItems: 0 }, plugin: { acceptedRows: 0 } }),
      JSON.stringify({ code: 'validation_failed', category: 'validation' }),
      'worker-a',
      '2026-05-09T12:01:30.000Z',
      'tenant-a',
      'job-1',
    ]);
  });

  it('updates progress, heartbeat and cancellation independently from terminal state changes', async () => {
    const { executor, statements } = createQueuedExecutor([[jobRow], [jobRow], [jobRow]]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.updateJobProgress({
        jobId: 'job-1',
        instanceId: 'tenant-a',
        progress: {
          completedSteps: 2,
          totalSteps: 3,
          currentPhase: 'mapping',
          currentStepKey: 'persist-content',
          lastUpdatedAt: '2026-05-09T12:02:30.000Z',
        },
        lastProgressAt: '2026-05-09T12:02:30.000Z',
        heartbeatAt: '2026-05-09T12:02:30.000Z',
      })
    ).resolves.toMatchObject({ id: 'job-1' });

    await expect(
      repository.touchJobHeartbeat({
        jobId: 'job-1',
        instanceId: 'tenant-a',
        workerId: 'worker-b',
        heartbeatAt: '2026-05-09T12:03:00.000Z',
      })
    ).resolves.toMatchObject({ id: 'job-1' });

    await expect(
      repository.requestJobCancellation({
        jobId: 'job-1',
        instanceId: 'tenant-a',
        cancelRequestedAt: '2026-05-09T12:04:00.000Z',
      })
    ).resolves.toMatchObject({ id: 'job-1' });

    expect(statements[0]?.text).toContain('last_progress_at = $2');
    expect(statements[1]?.text).toContain('heartbeat_at = $1');
    expect(statements[2]?.text).toContain('cancel_requested_at = $1');
  });

  it('returns null for missing updates and detail reads', async () => {
    const { executor } = createQueuedExecutor([[], [], [], []]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.updateJobState({
        jobId: 'missing',
        instanceId: 'tenant-a',
        status: 'running',
        attempts: 1,
      })
    ).resolves.toBeNull();
    await expect(
      repository.updateJobProgress({
        jobId: 'missing',
        instanceId: 'tenant-a',
        progress: { completedSteps: 1, totalSteps: 2 },
        lastProgressAt: '2026-05-09T12:02:30.000Z',
      })
    ).resolves.toBeNull();
    await expect(
      repository.touchJobHeartbeat({
        jobId: 'missing',
        instanceId: 'tenant-a',
        heartbeatAt: '2026-05-09T12:03:00.000Z',
      })
    ).resolves.toBeNull();
    await expect(repository.getJobDetail('tenant-a', 'missing')).resolves.toBeNull();
  });

  it('returns job detail together with technical event history', async () => {
    const { executor } = createQueuedExecutor([[jobRow], [eventRow]]);
    const repository = createStudioJobRepository(executor);

    await expect(repository.getJobDetail('tenant-a', 'job-1')).resolves.toMatchObject({
      id: 'job-1',
      history: [
        {
          id: 'event-1',
          eventType: 'job.progressed',
          status: 'running',
          message: 'Schema validiert',
        },
      ],
    });
  });

  it('maps sparse event rows, appends minimal events and rejects missing returning rows', async () => {
    const sparseEventRow = {
      ...eventRow,
      progress: null,
      message: null,
      details: null,
    };
    const { executor } = createQueuedExecutor([[jobRow], [sparseEventRow], [sparseEventRow], []]);
    const repository = createStudioJobRepository(executor);

    await expect(repository.getJobDetail('tenant-a', 'job-1')).resolves.toMatchObject({
      history: [
        {
          id: 'event-1',
          progress: undefined,
          message: undefined,
          details: undefined,
        },
      ],
    });

    await expect(
      repository.appendJobEvent({
        id: 'event-2',
        jobId: 'job-1',
        instanceId: 'tenant-a',
        eventType: 'job.queued',
        status: 'queued',
        attempts: 0,
      })
    ).resolves.toMatchObject({
      id: 'event-1',
      progress: undefined,
      message: undefined,
      details: undefined,
    });

    await expect(
      repository.appendJobEvent({
        id: 'event-3',
        jobId: 'job-1',
        instanceId: 'tenant-a',
        eventType: 'job.started',
        status: 'running',
        attempts: 1,
      })
    ).rejects.toThrow('studio_job_event_create_failed:event-3');
  });

  it('lists jobs with pagination filters and latest event projection', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          ...jobRow,
          latest_event_id: 'event-1',
          latest_event_type: 'job.progressed',
          latest_event_status: 'running',
          latest_event_progress: eventRow.progress,
          latest_event_attempts: 1,
          latest_event_message: 'Schema validiert',
          latest_event_details: { plugin: { acceptedRows: 10 } },
          latest_event_created_at: '2026-05-09T12:03:00.000Z',
          total_count: 1,
        },
      ],
    ]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.listJobs('tenant-a', {
        view: 'history',
        page: 2,
        pageSize: 10,
        status: 'running',
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        q: 'corr',
      })
    ).resolves.toMatchObject({
      total: 1,
      items: [
        {
          id: 'job-1',
          latestEvent: {
            id: 'event-1',
            eventType: 'job.progressed',
            message: 'Schema validiert',
          },
        },
      ],
    });

    expect(statements[0]?.text).toContain('COUNT(*) OVER()::int AS total_count');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'running',
      'news',
      'news.import-articles',
      '%corr%',
      10,
      10,
    ]);
    expect(statements[0]?.text).toContain('j.id::text ILIKE $5');
    expect(statements[0]?.text).toContain("COALESCE(j.parent_job_id::text, '') ILIKE $5");
  });

  it('lists active jobs without hits and maps latest-event fallbacks when columns are sparse', async () => {
    const { executor, statements } = createQueuedExecutor([
      [],
      [
        {
          ...jobRow,
          latest_event_id: 'event-2',
          latest_event_type: null,
          latest_event_status: null,
          latest_event_progress: null,
          latest_event_attempts: null,
          latest_event_message: null,
          latest_event_details: null,
          latest_event_created_at: null,
          total_count: 1,
        },
      ],
    ]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.listJobs('tenant-a', {
        view: 'active',
        page: 1,
        pageSize: 25,
      })
    ).resolves.toEqual({
      items: [],
      total: 0,
    });

    await expect(
      repository.listJobs('tenant-a', {
        view: 'history',
        page: 1,
        pageSize: 25,
      })
    ).resolves.toMatchObject({
      total: 1,
      items: [
        {
          id: 'job-1',
          latestEvent: {
            id: 'event-2',
            eventType: 'job.queued',
            status: 'queued',
            attempts: 0,
            message: undefined,
            details: undefined,
            progress: undefined,
            createdAt: '2026-05-09T12:00:00.000Z',
          },
        },
      ],
    });

    expect(statements[0]?.text).toContain("j.status IN ('queued', 'running', 'retrying')");
    expect(statements[0]?.values).toEqual(['tenant-a', 25, 0]);
  });

  it('restricts history views to terminal states', async () => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.listJobs('tenant-a', {
        view: 'history',
        page: 1,
        pageSize: 25,
      })
    ).resolves.toEqual({
      items: [],
      total: 0,
    });

    expect(statements[0]?.text).toContain("j.status IN ('succeeded', 'failed', 'cancelled')");
  });

  it('rejects missing returning rows when creating jobs', async () => {
    const { executor } = createQueuedExecutor([[]]);
    const repository = createStudioJobRepository(executor);

    await expect(
      repository.createJob({
        id: 'job-3',
        instanceId: 'tenant-a',
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        queueName: 'plugin-operations',
        status: 'queued',
        inputPayload: { source: 'upload-3' },
        attempts: 0,
        maxAttempts: 5,
        idempotencyKey: 'idem-3',
        scheduledAt: '2026-05-09T12:00:00.000Z',
      })
    ).rejects.toThrow('studio_job_create_failed:job-3');
  });
});
