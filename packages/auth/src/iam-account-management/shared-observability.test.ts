import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  loggerWarn: vi.fn(),
  gaugeCallback: null as null | ((result: { observe: ReturnType<typeof vi.fn> }) => void),
}));

vi.mock('./shared-runtime.js', () => ({
  resolvePool: vi.fn(() => ({
    query: state.query,
  })),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: state.loggerWarn,
    error: vi.fn(),
  }),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: vi.fn() }),
      createHistogram: () => ({ record: vi.fn() }),
      createObservableGauge: (name: string) => ({
        addCallback: (callback: (result: { observe: ReturnType<typeof vi.fn> }) => void) => {
          if (name === 'sva_instance_admin_client_drift') {
            state.gaugeCallback = callback;
          }
        },
      }),
    }),
  },
}));

describe('shared-observability tenant admin drift metric', () => {
  beforeEach(() => {
    vi.resetModules();
    state.query.mockReset();
    state.loggerWarn.mockReset();
    state.gaugeCallback = null;
  });

  it('refreshes the drift snapshot for active instances and exposes aligned and drifting rows', async () => {
    state.query.mockResolvedValue({
      rows: [
        { instance_id: 'aligned', drift: 0, reason: 'aligned' },
        { instance_id: 'missing-client', drift: 1, reason: 'missing_client' },
        { instance_id: 'missing-secret', drift: 1, reason: 'missing_secret' },
      ],
    });

    const module = await import('./shared-observability.js');
    await module.refreshInstanceAdminClientDriftSnapshot(true);

    const observe = vi.fn();
    state.gaugeCallback?.({ observe });

    expect(observe).toHaveBeenCalledWith(0, {
      instance_id: 'aligned',
      drift_reason: 'aligned',
    });
    expect(observe).toHaveBeenCalledWith(1, {
      instance_id: 'missing-client',
      drift_reason: 'missing_client',
    });
    expect(observe).toHaveBeenCalledWith(1, {
      instance_id: 'missing-secret',
      drift_reason: 'missing_secret',
    });
  });

  it('logs and keeps the snapshot empty when the refresh query fails', async () => {
    state.query.mockRejectedValue(new Error('db offline'));

    const module = await import('./shared-observability.js');
    await module.refreshInstanceAdminClientDriftSnapshot(true);

    const observe = vi.fn();
    state.gaugeCallback?.({ observe });

    expect(observe).not.toHaveBeenCalled();
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'instance_admin_client_drift_metric_refresh_failed',
      expect.objectContaining({
        operation: 'refresh_instance_admin_client_drift_metric',
        dependency: 'database',
        error_type: 'Error',
      })
    );
  });
});
