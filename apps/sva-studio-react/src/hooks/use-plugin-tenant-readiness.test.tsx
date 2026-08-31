import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getInstancePluginReadiness: vi.fn(),
  startInstancePluginLifecycle: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  user: { instanceId: 'tenant-a' } as { instanceId?: string } | null,
}));

vi.mock('../lib/iam-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/iam-api')>();
  return {
    ...original,
    getInstancePluginReadiness: api.getInstancePluginReadiness,
    startInstancePluginLifecycle: api.startInstancePluginLifecycle,
  };
});

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => auth,
}));

import { usePluginTenantReadiness } from './use-plugin-tenant-readiness';

describe('usePluginTenantReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInstancePluginReadiness.mockResolvedValue({ data: [], meta: {} });
    api.startInstancePluginLifecycle.mockResolvedValue({ data: {}, meta: {} });
    auth.refreshSession.mockResolvedValue(undefined);
    auth.user = { instanceId: 'tenant-a' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads readiness and refreshes it after starting the declared lifecycle operation', async () => {
    const { result } = renderHook(() => usePluginTenantReadiness('tenant-a'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.startRepair('speech-flow', 'reconcile');
    });

    expect(api.startInstancePluginLifecycle).toHaveBeenCalledWith(
      'tenant-a',
      'speech-flow',
      'reconcile'
    );
    expect(api.getInstancePluginReadiness).toHaveBeenCalledTimes(2);
    expect(result.current.activeAction).toBeNull();
  });

  it('discards a repair completion after the selected instance changes', async () => {
    let completeRepair: (() => void) | undefined;
    api.startInstancePluginLifecycle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeRepair = () => resolve({ data: {}, meta: {} });
        })
    );
    api.getInstancePluginReadiness
      .mockResolvedValueOnce({ data: [{ pluginId: 'tenant-a-plugin' }], meta: {} })
      .mockResolvedValueOnce({ data: [{ pluginId: 'tenant-b-plugin' }], meta: {} });
    const { result, rerender } = renderHook(
      ({ instanceId }) => usePluginTenantReadiness(instanceId),
      { initialProps: { instanceId: 'tenant-a' } }
    );
    await waitFor(() => expect(result.current.items[0]?.pluginId).toBe('tenant-a-plugin'));

    let repairPromise: Promise<void> | undefined;
    act(() => {
      repairPromise = result.current.startRepair('speech-flow', 'reconcile');
    });
    expect(result.current.activeAction).toBe('speech-flow:reconcile');
    rerender({ instanceId: 'tenant-b' });
    await waitFor(() => expect(result.current.items[0]?.pluginId).toBe('tenant-b-plugin'));
    expect(result.current.activeAction).toBeNull();

    await act(async () => {
      completeRepair?.();
      await repairPromise;
    });

    expect(result.current.items[0]?.pluginId).toBe('tenant-b-plugin');
    expect(api.getInstancePluginReadiness).toHaveBeenCalledTimes(2);
  });

  it('polls readiness while a lifecycle job is active and stops after completion', async () => {
    let jobActive = true;
    let intervalCallback: (() => void) | undefined;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((
      handler: TimerHandler,
      timeout?: number
    ) => {
      if (timeout === 10_000) {
        intervalCallback = handler as () => void;
        return 9_999 as unknown as ReturnType<typeof window.setInterval>;
      }

      return originalSetInterval(handler, timeout);
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation((intervalId) => {
      if (intervalId !== (9_999 as unknown as number)) {
        originalClearInterval(intervalId);
      }
    });
    api.getInstancePluginReadiness.mockImplementation(async () =>
      jobActive
        ? {
            data: [{ pluginId: 'speech-flow', activeJobId: 'job-42' }],
            meta: {},
          }
        : { data: [{ pluginId: 'speech-flow' }], meta: {} }
    );

    const { result } = renderHook(() => usePluginTenantReadiness('tenant-a'));

    await waitFor(() => expect(result.current.items[0]?.activeJobId).toBe('job-42'));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);

    await act(async () => {
      jobActive = false;
      intervalCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.items[0]?.activeJobId).toBeUndefined());
    expect(clearIntervalSpy).toHaveBeenCalledWith(9_999 as unknown as number);
    expect(api.getInstancePluginReadiness).toHaveBeenCalledTimes(2);
  });

  it('polls readiness while a lifecycle retry deadline is pending and stops after recovery', async () => {
    let retryPending = true;
    let intervalCallback: (() => void) | undefined;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation(((handler: TimerHandler, timeout?: number) => {
        if (timeout === 10_000) {
          intervalCallback = handler as () => void;
          return 8_888 as unknown as ReturnType<typeof window.setInterval>;
        }

        return originalSetInterval(handler, timeout);
      }) as typeof window.setInterval);
    const clearIntervalSpy = vi
      .spyOn(window, 'clearInterval')
      .mockImplementation((intervalId) => {
        if (intervalId !== (8_888 as unknown as number)) {
          originalClearInterval(intervalId);
        }
      });
    api.getInstancePluginReadiness.mockImplementation(async () =>
      retryPending
        ? {
            data: [
              {
                pluginId: 'speech-flow',
                error: {
                  code: 'speech.databaseUnavailable',
                  retryKind: 'retryable',
                  retryAfter: '2999-08-30T12:10:00.000Z',
                },
              },
            ],
            meta: {},
          }
        : { data: [{ pluginId: 'speech-flow' }], meta: {} }
    );

    const { result } = renderHook(() => usePluginTenantReadiness('tenant-a'));

    await waitFor(() => expect(result.current.items[0]?.error?.retryKind).toBe('retryable'));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);

    await act(async () => {
      retryPending = false;
      intervalCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.items[0]?.error).toBeUndefined());
    expect(clearIntervalSpy).toHaveBeenCalledWith(8_888 as unknown as number);
    expect(api.getInstancePluginReadiness).toHaveBeenCalledTimes(2);
  });

  it('refreshes the current tenant auth snapshot when plugin access changes', async () => {
    let accessReady = false;
    api.getInstancePluginReadiness.mockImplementation(async () => ({
      data: [
        accessReady
          ? {
              pluginId: 'speech-flow',
              effectiveActive: true,
              accessState: 'active',
              evidenceState: 'valid',
              status: 'ready',
            }
          : {
              pluginId: 'speech-flow',
              effectiveActive: true,
              accessState: 'active',
              evidenceState: 'valid',
              status: 'pending',
            },
      ],
      meta: {},
    }));

    const { result } = renderHook(() => usePluginTenantReadiness('tenant-a'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.items).toHaveLength(1);
    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));

    await act(async () => {
      accessReady = true;
      await result.current.refresh();
    });

    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(2));
  });
});
