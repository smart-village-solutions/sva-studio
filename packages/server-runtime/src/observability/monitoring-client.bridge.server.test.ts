import { afterEach, describe, expect, it, vi } from 'vitest';

const importBridge = async () => import('./monitoring-client.bridge.server.js');

describe('monitoring client bridge', () => {
  afterEach(() => {
    vi.doUnmock('@sva/monitoring-client/server');
    vi.doUnmock('@sva/monitoring-client/logger-provider.server');
    vi.resetModules();
  });

  it('delegates workspace context and otel startup to monitoring-client/server', async () => {
    const setWorkspaceContextGetter = vi.fn();
    const startOtelSdk = vi.fn().mockResolvedValue({ shutdown: vi.fn() });

    vi.doMock('@sva/monitoring-client/server', () => ({
      setWorkspaceContextGetter,
      startOtelSdk,
    }));

    const bridge = await importBridge();
    const getter = () => ({ workspaceId: 'tenant-a' });

    await bridge.setWorkspaceContextGetterForMonitoring(getter);
    await expect(
      bridge.startOtelSdkFromMonitoring({
        serviceName: 'svc',
        environment: 'test',
        otlpEndpoint: 'http://otel.test',
        logLevel: 1,
      })
    ).resolves.toEqual({ shutdown: expect.any(Function) });

    expect(setWorkspaceContextGetter).toHaveBeenCalledWith(getter);
    expect(startOtelSdk).toHaveBeenCalledWith({
      serviceName: 'svc',
      environment: 'test',
      otlpEndpoint: 'http://otel.test',
      logLevel: 1,
    });
  });

  it('delegates logger provider access to monitoring-client logger provider', async () => {
    const provider = { getLogger: vi.fn() };
    const getGlobalLoggerProvider = vi.fn(() => provider);
    const setGlobalLoggerProvider = vi.fn();

    vi.doMock('@sva/monitoring-client/logger-provider.server', () => ({
      getGlobalLoggerProvider,
      setGlobalLoggerProvider,
    }));

    const bridge = await importBridge();

    await expect(bridge.getGlobalLoggerProviderFromMonitoring()).resolves.toBe(provider);
    await bridge.setGlobalLoggerProviderForMonitoring(null);

    expect(getGlobalLoggerProvider).toHaveBeenCalledWith();
    expect(setGlobalLoggerProvider).toHaveBeenCalledWith(null);
  });

  it('fails fast when dynamically imported monitoring modules have an unexpected shape', async () => {
    vi.doMock('@sva/monitoring-client/server', () => ({
      setWorkspaceContextGetter: 'not-a-function',
      startOtelSdk: vi.fn(),
    }));
    vi.doMock('@sva/monitoring-client/logger-provider.server', () => ({
      getGlobalLoggerProvider: vi.fn(),
      setGlobalLoggerProvider: 'not-a-function',
    }));

    const bridge = await importBridge();

    await expect(
      bridge.startOtelSdkFromMonitoring({ serviceName: 'svc' })
    ).rejects.toThrow('Invalid monitoring server module shape');
    await expect(bridge.getGlobalLoggerProviderFromMonitoring()).rejects.toThrow(
      'Invalid monitoring logger provider module shape'
    );
  });
});
