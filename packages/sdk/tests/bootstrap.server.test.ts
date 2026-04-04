import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startOtelSdkFromMonitoring = vi.fn(async () => ({
  shutdown: vi.fn(async () => undefined),
  loggerProvider: {
    forceFlush: vi.fn(async () => undefined),
  },
}));

const setWorkspaceContextGetterForMonitoring = vi.fn(async () => undefined);
const infoMock = vi.fn();
const errorMock = vi.fn();

vi.mock('../src/observability/monitoring-client.bridge.server', () => ({
  setWorkspaceContextGetterForMonitoring,
  startOtelSdkFromMonitoring,
}));

vi.mock('../src/logger/index.server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: infoMock,
    error: errorMock,
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

  it('does not initialize OTEL when disabled explicitly', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';
    process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS = 'true';

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    const result = await initializeOtelSdk();

    expect(result).toEqual({
      status: 'disabled',
      reason: 'OTEL fuer dieses Laufzeitprofil deaktiviert.',
    });
    expect(setWorkspaceContextGetterForMonitoring).not.toHaveBeenCalled();
    expect(startOtelSdkFromMonitoring).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledWith('observability_ready', expect.objectContaining({
      logger_mode: 'console_to_loki',
      otel_status: 'disabled',
    }));
  });

  it('initializes OTEL when requested', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_OTEL;

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    const result = await initializeOtelSdk();

    expect(result.status).toBe('ready');
    expect(setWorkspaceContextGetterForMonitoring).toHaveBeenCalledTimes(1);
    expect(startOtelSdkFromMonitoring).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith('observability_ready', expect.objectContaining({
      logger_mode: 'otel_to_loki',
      otel_status: 'ready',
    }));
  });

  it('throws in production when OTEL initialization fails', async () => {
    process.env.NODE_ENV = 'production';
    startOtelSdkFromMonitoring.mockRejectedValueOnce(new Error('collector unavailable'));

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await expect(initializeOtelSdk()).rejects.toThrow('collector unavailable');
    expect(errorMock).toHaveBeenCalledWith('observability_degraded', expect.objectContaining({
      logger_mode: 'otel_to_loki',
      otel_status: 'failed',
    }));
  });
});
