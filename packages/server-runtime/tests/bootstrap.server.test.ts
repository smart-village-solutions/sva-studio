import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startOtelSdkFromMonitoring = vi.fn();

const setWorkspaceContextGetterForMonitoring = vi.fn(async () => undefined);
const infoMock = vi.fn();
const errorMock = vi.fn();
const processOnMock = vi.spyOn(process, 'on');
const processExitMock = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

const createSdkMock = () => ({
  shutdown: vi.fn(async () => undefined),
  loggerProvider: {
    forceFlush: vi.fn(async () => undefined),
  },
});

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
    startOtelSdkFromMonitoring.mockImplementation(async () => createSdkMock());
    processOnMock.mockClear();
    processExitMock.mockClear();
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

  it('returns the cached initialization result on repeated calls', async () => {
    process.env.NODE_ENV = 'development';

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    const first = await initializeOtelSdk();
    const second = await initializeOtelSdk();

    expect(first).toBe(second);
    expect(startOtelSdkFromMonitoring).toHaveBeenCalledTimes(1);
  });

  it('returns failed status without throwing when OTEL is optional', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_OTEL = 'true';
    startOtelSdkFromMonitoring.mockRejectedValueOnce(new Error('collector unavailable'));

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await expect(initializeOtelSdk()).resolves.toEqual({
      status: 'failed',
      reason: 'collector unavailable',
    });
    expect(errorMock).toHaveBeenCalledWith(
      'Fehler beim Initialisieren des OTEL SDK',
      expect.objectContaining({ error: 'collector unavailable' })
    );
  });

  it('marks observability as degraded when OTEL is disabled and console logs are disabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';
    process.env.SVA_ENABLE_SERVER_CONSOLE_LOGS = 'false';

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await expect(initializeOtelSdk()).resolves.toEqual({
      status: 'disabled',
      reason: 'OTEL fuer dieses Laufzeitprofil deaktiviert.',
    });
    expect(errorMock).toHaveBeenCalledWith(
      'observability_degraded',
      expect.objectContaining({
        logger_mode: 'degraded',
        otel_status: 'disabled',
      })
    );
  });

  it('flushes the OTEL logger provider when available', async () => {
    process.env.NODE_ENV = 'development';
    const sdk = createSdkMock();
    startOtelSdkFromMonitoring.mockResolvedValueOnce(sdk);

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk, flushOtelSdk } = await import('../src/server/bootstrap.server');

    await initializeOtelSdk();
    await flushOtelSdk(1234);

    expect(sdk.loggerProvider.forceFlush).toHaveBeenCalledWith(1234);
  });

  it('logs flush failures and ignores missing logger providers', async () => {
    process.env.NODE_ENV = 'development';
    const sdkWithoutLoggerProvider = {
      shutdown: vi.fn(async () => undefined),
    };
    const sdkWithFailingLoggerProvider = {
      shutdown: vi.fn(async () => undefined),
      loggerProvider: {
        forceFlush: vi.fn(async () => {
          throw new Error('flush failed');
        }),
      },
    };

    const runtime = await import('../src/logger/logging-runtime.server');

    runtime.resetLoggingRuntimeForTests();
    startOtelSdkFromMonitoring.mockResolvedValueOnce(sdkWithoutLoggerProvider);
    let mod = await import('../src/server/bootstrap.server');
    await mod.initializeOtelSdk();
    await expect(mod.flushOtelSdk()).resolves.toBeUndefined();

    runtime.resetLoggingRuntimeForTests();
    vi.resetModules();
    startOtelSdkFromMonitoring.mockResolvedValueOnce(sdkWithFailingLoggerProvider);
    mod = await import('../src/server/bootstrap.server');
    await mod.initializeOtelSdk();
    await expect(mod.flushOtelSdk()).resolves.toBeUndefined();

    expect(errorMock).toHaveBeenCalledWith(
      'Fehler beim Flushen des OTEL SDK',
      expect.objectContaining({ error: 'flush failed' })
    );
  });

  it('registers graceful shutdown handlers that flush and exit cleanly', async () => {
    process.env.NODE_ENV = 'development';
    const sdk = createSdkMock();
    startOtelSdkFromMonitoring.mockResolvedValueOnce(sdk);

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await initializeOtelSdk();

    const sigtermHandler = processOnMock.mock.calls.find(([event]) => event === 'SIGTERM')?.[1];
    expect(sigtermHandler).toBeTypeOf('function');

    await (sigtermHandler as () => Promise<void>)();

    expect(sdk.loggerProvider.forceFlush).toHaveBeenCalledWith(5000);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(processExitMock).toHaveBeenCalledWith(0);
  });

  it('logs graceful shutdown errors before exiting', async () => {
    process.env.NODE_ENV = 'development';
    const sdk = {
      shutdown: vi.fn(async () => {
        throw new Error('shutdown failed');
      }),
      loggerProvider: {
        forceFlush: vi.fn(async () => undefined),
      },
    };
    startOtelSdkFromMonitoring.mockResolvedValueOnce(sdk);

    const runtime = await import('../src/logger/logging-runtime.server');
    runtime.resetLoggingRuntimeForTests();
    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');

    await initializeOtelSdk();
    const sigintHandler = processOnMock.mock.calls.find(([event]) => event === 'SIGINT')?.[1];

    await (sigintHandler as () => Promise<void>)();

    expect(errorMock).toHaveBeenCalledWith(
      'Fehler beim OTEL SDK Shutdown',
      expect.objectContaining({ error: 'shutdown failed', signal: 'SIGINT' })
    );
    expect(processExitMock).toHaveBeenCalledWith(0);
  });
});
