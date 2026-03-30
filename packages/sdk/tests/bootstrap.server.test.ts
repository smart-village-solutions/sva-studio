import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startOtelSdkFromMonitoring = vi.fn(async () => ({
  shutdown: vi.fn(async () => undefined),
  loggerProvider: {
    forceFlush: vi.fn(async () => undefined),
  },
}));

const setWorkspaceContextGetterForMonitoring = vi.fn(async () => undefined);

vi.mock('../src/observability/monitoring-client.bridge.server', () => ({
  setWorkspaceContextGetterForMonitoring,
  startOtelSdkFromMonitoring,
}));

vi.mock('../src/logger/index.server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    on: vi.fn(),
  }),
}));

describe('initializeOtelSdk', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not initialize OTEL in development when ENABLE_OTEL=false is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_OTEL = 'false';

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    const result = await initializeOtelSdk();

    expect(result).toEqual({
      status: 'disabled',
      reason: 'OTEL in der Development-Umgebung explizit deaktiviert.',
    });
    expect(setWorkspaceContextGetterForMonitoring).not.toHaveBeenCalled();
    expect(startOtelSdkFromMonitoring).not.toHaveBeenCalled();
  });

  it('initializes OTEL in development by default', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_OTEL;

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    const result = await initializeOtelSdk();

    expect(result.status).toBe('ready');
    expect(setWorkspaceContextGetterForMonitoring).toHaveBeenCalledTimes(1);
    expect(startOtelSdkFromMonitoring).toHaveBeenCalledTimes(1);
  });

  it('throws in production when OTEL initialization fails', async () => {
    process.env.NODE_ENV = 'production';
    startOtelSdkFromMonitoring.mockRejectedValueOnce(new Error('collector unavailable'));

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await expect(initializeOtelSdk()).rejects.toThrow('collector unavailable');
  });
});
