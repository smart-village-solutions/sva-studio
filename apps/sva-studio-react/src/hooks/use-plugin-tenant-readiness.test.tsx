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
});
