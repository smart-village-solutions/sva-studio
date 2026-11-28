import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  getJobById: vi.fn(),
  withDb: vi.fn(),
}));

vi.mock('../db.js', () => ({
  createPoolResolver: () => () => null,
  withResolvedInstanceDb: state.withDb,
}));
vi.mock('@sva/data-repositories', () => ({
  createStudioJobRepository: () => ({ getJobById: state.getJobById }),
  createPluginTenantLifecycleRepository: vi.fn(),
}));
vi.mock('../plugin-tenant-lifecycle/job-correlation.js', () => ({
  pluginTenantLifecycleJobInputKey: 'studioTenantLifecycle',
}));
vi.mock('./runner-queue.js', () => ({}));

import {
  listStudioJobReconciliationCandidates,
  withStudioJobReconciliationCandidate,
} from './repository.js';

const instanceId = 'test-tenant';
const jobId = '4248eaf3-daf8-4d77-81af-c6d88331763c';
const job = { id: jobId, queueName: 'plugin-operations', attempts: 2 };
const task = 'studio_job_execute_privileged';

beforeEach(() => {
  vi.resetAllMocks();
  state.withDb.mockImplementation(async (_pool, _instanceId, work) => work({ query: state.query }));
  state.query.mockResolvedValueOnce({ rows: [] });
});

it('scans only the tenant candidates after the cursor and applies query timeouts', async () => {
  state.query.mockResolvedValueOnce({ rows: [{ id: jobId }] });

  await expect(listStudioJobReconciliationCandidates(instanceId, jobId, 23)).resolves.toEqual([
    jobId,
  ]);
  expect(state.withDb).toHaveBeenCalledWith(expect.any(Function), instanceId, expect.any(Function));
  expect(state.query).toHaveBeenNthCalledWith(1, expect.stringContaining('statement_timeout'));
  expect(state.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY id LIMIT $4'), [
    instanceId,
    jobId,
    'studioTenantLifecycle',
    23,
  ]);
});

it.each([
  { rows: [{ exhausted: true }], expected: true },
  { rows: [{ exhausted: false }], expected: false },
  { rows: [{ exhausted: null }], expected: null },
  { rows: [], expected: null },
])(
  'passes through queue evidence $rows inside the tenant transaction',
  async ({ rows, expected }) => {
    state.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rows });
    state.getJobById.mockResolvedValueOnce(job);

    await expect(
      withStudioJobReconciliationCandidate(
        instanceId,
        jobId,
        (selectedJob, _repository, lockQueue) => {
          expect(selectedJob).toEqual(job);
          return lockQueue(task);
        }
      )
    ).resolves.toBe(expected);
    expect(state.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      [instanceId, jobId, 'studioTenantLifecycle']
    );
    expect(state.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('graphile_worker.sva_lock_exhausted_studio_job'),
      [jobId, task, job.queueName, job.attempts]
    );
  }
);

it.each([0, 1])(
  'skips a candidate that is no longer eligible with lock row count %i',
  async (rowCount) => {
    state.query.mockResolvedValueOnce({ rowCount });
    state.getJobById.mockResolvedValueOnce(null);
    const reconcile = vi.fn();

    await expect(
      withStudioJobReconciliationCandidate(instanceId, jobId, reconcile)
    ).resolves.toBeUndefined();
    expect(reconcile).not.toHaveBeenCalled();
    expect(state.query).toHaveBeenCalledTimes(2);
  }
);
