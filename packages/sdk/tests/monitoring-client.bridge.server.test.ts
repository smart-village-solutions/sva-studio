import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unmock('@sva/monitoring-client/server');
  vi.unmock('@sva/monitoring-client/logger-provider.server');
});

describe('monitoring-client bridge', () => {
  it('caches the monitoring server module and forwards calls', async () => {
    const setWorkspaceContextGetter = vi.fn();
    const startOtelSdk = vi.fn(async (config: Record<string, unknown>) => config);

    vi.doMock('@sva/monitoring-client/server', () => ({
      setWorkspaceContextGetter,
      startOtelSdk,
    }));

    const bridge = await import('../src/observability/monitoring-client.bridge.server');
    const getter = () => ({ workspaceId: 'ws-1' });

    await bridge.setWorkspaceContextGetterForMonitoring(getter);
    await bridge.startOtelSdkFromMonitoring({ serviceName: 'sdk-test' });
    await bridge.startOtelSdkFromMonitoring({ serviceName: 'sdk-test-2' });

    expect(setWorkspaceContextGetter).toHaveBeenCalledWith(getter);
    expect(startOtelSdk).toHaveBeenCalledTimes(2);
  });

  it('throws for invalid monitoring server module shapes', async () => {
    vi.doMock('@sva/monitoring-client/server', () => ({
      setWorkspaceContextGetter: undefined,
      startOtelSdk: vi.fn(),
    }));

    const bridge = await import('../src/observability/monitoring-client.bridge.server');

    await expect(
      bridge.setWorkspaceContextGetterForMonitoring(() => ({ workspaceId: 'ws-1' }))
    ).rejects.toThrow('Invalid monitoring server module shape');
  });

  it('forwards provider getter and setter through the logger-provider bridge', async () => {
    const provider = { getLogger: vi.fn() };
    const getGlobalLoggerProvider = vi.fn(() => provider);
    const setGlobalLoggerProvider = vi.fn();

    vi.doMock('@sva/monitoring-client/logger-provider.server', () => ({
      getGlobalLoggerProvider,
      setGlobalLoggerProvider,
    }));

    const bridge = await import('../src/observability/monitoring-client.bridge.server');

    await bridge.setGlobalLoggerProviderForMonitoring(provider);
    await expect(bridge.getGlobalLoggerProviderFromMonitoring()).resolves.toBe(provider);
    expect(setGlobalLoggerProvider).toHaveBeenCalledWith(provider);
  });

  it('throws for invalid logger-provider module shapes', async () => {
    vi.doMock('@sva/monitoring-client/logger-provider.server', () => ({
      getGlobalLoggerProvider: vi.fn(),
      setGlobalLoggerProvider: undefined,
    }));

    const bridge = await import('../src/observability/monitoring-client.bridge.server');

    await expect(bridge.getGlobalLoggerProviderFromMonitoring()).rejects.toThrow(
      'Invalid monitoring logger provider module shape'
    );
  });
});
