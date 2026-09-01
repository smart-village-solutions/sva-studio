import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  callbacks: new Map<
    string,
    (result: { observe: ReturnType<typeof vi.fn> }) => Promise<void> | void
  >(),
  batchCallback: undefined as
    | ((result: {
        observe: (instrument: { name: string }, value: number, attributes: object) => void;
      }) => Promise<void> | void)
    | undefined,
  logger: { warn: vi.fn() },
  query: vi.fn(),
  resolvePool: vi.fn(),
  withIamAppDb: vi.fn(),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createObservableGauge: (name: string) => ({
        name,
        addCallback: (
          callback: (result: { observe: ReturnType<typeof vi.fn> }) => Promise<void> | void
        ) => {
          state.callbacks.set(name, callback);
        },
      }),
      addBatchObservableCallback: (
        callback: (result: {
          observe: (instrument: { name: string }, value: number, attributes: object) => void;
        }) => Promise<void> | void
      ) => {
        state.batchCallback = callback;
      },
    }),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../db.js', () => ({
  resolvePool: state.resolvePool,
  withIamAppDb: state.withIamAppDb,
}));

const collect = async (metricName: string) => {
  const observe = vi.fn();
  const callback = state.callbacks.get(metricName);
  if (callback) {
    await callback({ observe });
  } else {
    expect(state.batchCallback).toBeDefined();
    await state.batchCallback?.({
      observe: (instrument, value, attributes) => {
        if (instrument.name === metricName) observe(value, attributes);
      },
    });
  }
  return observe;
};

describe('plugin tenant lifecycle observability', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
    state.callbacks.clear();
    state.batchCallback = undefined;
    state.resolvePool.mockReturnValue({ query: state.query });
    state.withIamAppDb.mockImplementation(
      async (work: (client: { query: typeof state.query }) => Promise<unknown>) =>
        work({ query: state.query })
    );
    state.query.mockResolvedValue({
      rowCount: 5,
      rows: [
        { reason_code: 'stale_claim', stall_count: '1' },
        { reason_code: 'queued_due', stall_count: '2' },
        { reason_code: 'retry_due', stall_count: '3' },
        { reason_code: 'pending_recheck_due', stall_count: '4' },
        { reason_code: 'generation_without_owner', stall_count: '5' },
      ],
    });
    process.env.SVA_PLUGIN_OPERATION_WORKER_LANE = 'privileged';
    delete process.env.SVA_PLUGIN_OPERATION_WORKER_ENABLED;
  });

  it('reads only the parameterless aggregate database contract and normalizes all bounded reasons', async () => {
    const observability = await import('./observability.js');

    await expect(observability.readPluginTenantLifecycleStallSnapshot()).resolves.toEqual({
      stale_claim: 1,
      queued_due: 2,
      retry_due: 3,
      pending_recheck_due: 4,
      generation_without_owner: 5,
    });
    expect(state.query).toHaveBeenCalledWith(
      'SELECT reason_code, stall_count FROM iam.plugin_tenant_lifecycle_observability_snapshot();'
    );
    expect(state.withIamAppDb).toHaveBeenCalledOnce();
    expect(state.query.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('exports every stall reason with only a bounded reason_code label', async () => {
    const observability = await import('./observability.js');
    const stallObserve = await collect('sva_plugin_tenant_lifecycle_stall_count');
    const failureObserve = await collect('sva_plugin_tenant_lifecycle_observation_failure');

    expect(stallObserve.mock.calls).toEqual(
      observability.pluginTenantLifecycleStallReasons.map((reasonCode, index) => [
        index + 1,
        {
          reason_code: reasonCode,
        },
      ])
    );
    expect(failureObserve).toHaveBeenCalledWith(0, { reason_code: 'database_unavailable' });
    expect(failureObserve).toHaveBeenCalledWith(0, { reason_code: 'database_query_failed' });
    for (const [, attributes] of stallObserve.mock.calls) {
      expect(Object.keys(attributes)).toEqual(['reason_code']);
      expect(attributes).not.toHaveProperty('instance_id');
      expect(attributes).not.toHaveProperty('plugin_id');
      expect(attributes).not.toHaveProperty('job_id');
      expect(attributes).not.toHaveProperty('request_id');
      expect(attributes).not.toHaveProperty('correlation_id');
    }
  });

  it('throttles fleet-wide aggregate reads across metric collections', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T10:00:00.000Z'));
    await import('./observability.js');

    await collect('sva_plugin_tenant_lifecycle_stall_count');
    await collect('sva_plugin_tenant_lifecycle_observation_failure');
    expect(state.query).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await collect('sva_plugin_tenant_lifecycle_stall_count');
    expect(state.query).toHaveBeenCalledTimes(2);
  });

  it('fails observability closed without throwing from asynchronous metric collection', async () => {
    state.resolvePool.mockReturnValue(null);
    await import('./observability.js');
    const unavailable = await collect('sva_plugin_tenant_lifecycle_observation_failure');
    expect(unavailable).toHaveBeenCalledWith(1, { reason_code: 'database_unavailable' });

    vi.resetModules();
    state.callbacks.clear();
    state.batchCallback = undefined;
    state.resolvePool.mockReturnValue({ query: state.query });
    state.query.mockRejectedValueOnce(new Error('database unavailable'));
    await import('./observability.js');
    const failed = await collect('sva_plugin_tenant_lifecycle_observation_failure');
    expect(failed).toHaveBeenCalledWith(1, { reason_code: 'database_query_failed' });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'plugin_tenant_lifecycle_observability_query_failed',
      expect.objectContaining({ operation: 'plugin_tenant_lifecycle_observability_snapshot' })
    );
  });

  it('exports only the own lane and keeps status, reason and success labels bounded', async () => {
    const observability = await import('./observability.js');
    observability.recordPluginTenantLifecycleLaneHealth('privileged', {
      ready: false,
      reasonCode: 'privileged_studio_job_worker_runtime_failed',
      status: 'failed',
    });
    observability.recordPluginTenantLifecycleLaneSuccess('privileged', 1_000);

    const ready = await collect('sva_plugin_tenant_lifecycle_lane_ready');
    const statuses = await collect('sva_plugin_tenant_lifecycle_lane_status');
    const reasons = await collect('sva_plugin_tenant_lifecycle_lane_failure');
    const age = await collect('sva_plugin_tenant_lifecycle_lane_seconds_since_success');

    expect(ready).toHaveBeenCalledExactlyOnceWith(0, { lane: 'privileged' });
    expect(statuses).toHaveBeenCalledTimes(observability.pluginTenantLifecycleLaneStatuses.length);
    expect(reasons).toHaveBeenCalledTimes(
      observability.pluginTenantLifecycleLaneFailureReasons.length
    );
    expect(statuses).toHaveBeenCalledWith(1, { lane: 'privileged', status: 'failed' });
    expect(reasons).toHaveBeenCalledWith(1, {
      lane: 'privileged',
      reason_code: 'privileged_studio_job_worker_runtime_failed',
    });
    expect(age).toHaveBeenCalledWith(expect.any(Number), { lane: 'privileged' });
    for (const observe of [ready, statuses, reasons, age]) {
      expect(JSON.stringify(observe.mock.calls)).not.toMatch(
        /instance_id|plugin_id|job_id|generation|request_id|correlation_id/i
      );
    }
  });
});
