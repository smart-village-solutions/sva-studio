import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  withCandidate: vi.fn(),
  callbacks: new Map<
    string,
    (result: { observe: (value: number, labels?: { outcome: string }) => void }) => void
  >(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createObservableGauge: (name: string) => ({
        addCallback: (callback: Parameters<typeof state.callbacks.set>[1]) =>
          state.callbacks.set(name, callback),
      }),
    }),
  },
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn(), info: vi.fn() }),
}));
vi.mock('../iam-instance-registry/repository.js', () => ({
  listActiveInstanceIdsForWorker: async () => ['test-tenant'],
}));
vi.mock('./repository.js', () => ({
  listStudioJobReconciliationCandidates: state.listCandidates,
  withStudioJobReconciliationCandidate: state.withCandidate,
}));
vi.mock('./runner-internal.js', () => ({
  getRegisteredStudioJobExecutionRegistry: () =>
    new Map([
      ['host:fixture', {}],
      ['host:privileged-fixture', { executionLane: 'privileged' }],
    ]),
  toRegistryKey: (source: string, jobTypeId: string) => `${source}:${jobTypeId}`,
  studioJobTaskIdentifier: 'studio_job_execute',
  privilegedStudioJobTaskIdentifier: 'studio_job_execute_privileged',
}));

import { createStudioJobReconciliation, reconcileStudioJob } from './runner-reconciliation.js';

beforeEach(() => {
  state.listCandidates.mockReset();
  state.withCandidate.mockReset();
});
afterEach(() => vi.restoreAllMocks());

const collect = (metric: string) => {
  const observe = vi.fn();
  const callback = state.callbacks.get(metric);
  expect(callback).toBeDefined();
  callback?.({ observe });
  return observe;
};

it('rechecks outstanding observations within the page limit and withholds success until they clear', async () => {
  const check = createStudioJobReconciliation();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(120_000);
  const successMetric = 'sva_studio_job_reconciliation_last_success_timestamp_seconds';
  const countsMetric = 'sva_studio_job_reconciliation_jobs';
  const firstPage = [
    'unresolved-job',
    'unknown-job',
    ...Array.from({ length: 23 }, (_, i) => `a${i}`),
  ];
  const secondPage = Array.from({ length: 23 }, (_, i) => `b${i}`);
  let settled = false;
  state.listCandidates
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce(secondPage)
    .mockResolvedValueOnce([]);
  state.withCandidate.mockImplementation(async (tenant, id, inspect) => {
    if (settled) return undefined;
    return inspect(
      {
        id,
        instanceId: tenant,
        source: 'host',
        jobTypeId: 'fixture',
        status: 'running',
        attempts: 1,
      },
      { transitionJobStateAndAppendEvent: async () => ({ outcome: 'conflict' }) },
      async () => (id === 'unknown-job' ? null : id === 'unresolved-job')
    );
  });

  await check();
  expect(collect(successMetric)).toHaveBeenCalledWith(120);
  clock.mockReturnValue(180_000);
  await check();
  clock.mockReturnValue(240_000);
  state.withCandidate.mockClear();
  await check();
  expect(state.listCandidates).toHaveBeenLastCalledWith('test-tenant', 'a22', 23);
  expect(state.withCandidate).toHaveBeenCalledTimes(25);
  expect(collect(countsMetric)).toHaveBeenCalledWith(1, { outcome: 'unresolved' });
  expect(collect(countsMetric)).toHaveBeenCalledWith(1, { outcome: 'unknown' });
  expect(collect(successMetric)).toHaveBeenCalledWith(120);

  settled = true;
  clock.mockReturnValue(300_000);
  await check();
  expect(collect(countsMetric)).toHaveBeenCalledWith(0, { outcome: 'unresolved' });
  expect(collect(countsMetric)).toHaveBeenCalledWith(0, { outcome: 'unknown' });
  expect(collect(successMetric)).toHaveBeenCalledWith(300);
});

it.each([
  { status: 'queued', attempts: 0, expectedStatus: 'cancelled' },
  { status: 'running', attempts: 1, expectedStatus: 'failed' },
])(
  'closes a $status privileged job as $expectedStatus after exhausting the queue',
  async ({ status, attempts, expectedStatus }) => {
    const lock = vi.fn(async () => true);
    const transition = vi.fn(async () => ({ outcome: 'applied' }));
    const cancelRequestedAt = '2026-05-01T10:10:00.000Z';
    state.withCandidate.mockImplementationOnce(async (instanceId, id, inspect) =>
      inspect(
        {
          id,
          instanceId,
          source: 'host',
          jobTypeId: 'privileged-fixture',
          status,
          attempts,
          cancelRequestedAt,
        },
        { transitionJobStateAndAppendEvent: transition },
        lock
      )
    );

    await expect(reconcileStudioJob('test-tenant', 'job')).resolves.toBe('finalized');
    expect(lock).toHaveBeenCalledExactlyOnceWith('studio_job_execute_privileged');
    expect(transition).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: expectedStatus,
        expectedStatuses: [status],
        expectedAttempts: attempts,
        expectedWorkerId: null,
        event: expect.objectContaining({
          eventType: `job.${expectedStatus}`,
          details: expect.objectContaining({
            host: expect.objectContaining({ cancellationRequestedAt: cancelRequestedAt }),
          }),
        }),
      })
    );
  }
);

it('counts a queue read failure as unknown and still checks other candidates', async () => {
  state.listCandidates.mockResolvedValueOnce(['queue-unavailable', 'fresh']);
  state.withCandidate
    .mockRejectedValueOnce(new Error('queue unavailable'))
    .mockResolvedValueOnce(undefined);
  await createStudioJobReconciliation()();

  expect(state.withCandidate).toHaveBeenLastCalledWith(
    'test-tenant',
    'fresh',
    expect.any(Function)
  );
  expect(collect('sva_studio_job_reconciliation_jobs')).toHaveBeenCalledWith(1, {
    outcome: 'unknown',
  });
});
