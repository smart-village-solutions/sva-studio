import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getInstancePluginReadiness: vi.fn(),
  startInstancePluginLifecycle: vi.fn(),
}));

vi.mock('../lib/iam-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/iam-api')>();
  return {
    ...original,
    getInstancePluginReadiness: api.getInstancePluginReadiness,
    startInstancePluginLifecycle: api.startInstancePluginLifecycle,
  };
});

import { usePluginTenantReadiness } from './use-plugin-tenant-readiness';

describe('usePluginTenantReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInstancePluginReadiness.mockResolvedValue({ data: [], meta: {} });
    api.startInstancePluginLifecycle.mockResolvedValue({ data: {}, meta: {} });
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
});
