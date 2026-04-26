import { afterEach, describe, expect, it, vi } from 'vitest';

type RuntimeConfig = {
  environment: 'development' | 'production';
  consoleEnabled: boolean;
  uiEnabled: boolean;
  otelRequested: boolean;
  otelRequired: boolean;
  mode: 'console_to_loki' | 'otel_to_loki' | 'degraded';
};

const logger = {
  info: vi.fn(),
  error: vi.fn(),
};

const defaultRuntimeConfig: RuntimeConfig = {
  environment: 'development',
  consoleEnabled: true,
  uiEnabled: true,
  otelRequested: true,
  otelRequired: false,
  mode: 'otel_to_loki',
};

const importBootstrap = async (input: {
  runtimeConfig?: Partial<RuntimeConfig>;
  startOtelSdk?: ReturnType<typeof vi.fn>;
  setWorkspaceContextGetter?: ReturnType<typeof vi.fn>;
} = {}) => {
  const runtimeConfig = { ...defaultRuntimeConfig, ...input.runtimeConfig };
  const setOtelInitializationResult = vi.fn();
  const startOtelSdk = input.startOtelSdk ?? vi.fn().mockResolvedValue({ shutdown: vi.fn() });
  const setWorkspaceContextGetter = input.setWorkspaceContextGetter ?? vi.fn().mockResolvedValue(undefined);

  vi.doMock('../logger/index.server.js', () => ({
    createSdkLogger: vi.fn(() => logger),
  }));
  vi.doMock('../logger/logging-runtime.server.js', () => ({
    getLoggingRuntimeConfig: vi.fn(() => runtimeConfig),
    getOtelInitializationResult: vi.fn(() => ({
      status: 'pending',
      reason: 'Test-Reset',
    })),
    setOtelInitializationResult,
  }));
  vi.doMock('../observability/monitoring-client.bridge.server.js', () => ({
    setWorkspaceContextGetterForMonitoring: setWorkspaceContextGetter,
    startOtelSdkFromMonitoring: startOtelSdk,
  }));

  const module = await import('./bootstrap.server.js');
  return {
    module,
    setOtelInitializationResult,
    setWorkspaceContextGetter,
    startOtelSdk,
  };
};

describe('server bootstrap', () => {
  afterEach(() => {
    vi.doUnmock('../logger/index.server.js');
    vi.doUnmock('../logger/logging-runtime.server.js');
    vi.doUnmock('../observability/monitoring-client.bridge.server.js');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    logger.info.mockReset();
    logger.error.mockReset();
  });

  it('marks otel as disabled when runtime config does not request it', async () => {
    const { module, setOtelInitializationResult, startOtelSdk } = await importBootstrap({
      runtimeConfig: {
        otelRequested: false,
        mode: 'console_to_loki',
      },
    });

    await expect(module.initializeOtelSdk()).resolves.toEqual({
      status: 'disabled',
      reason: 'OTEL fuer dieses Laufzeitprofil deaktiviert.',
    });

    expect(startOtelSdk).not.toHaveBeenCalled();
    expect(setOtelInitializationResult).toHaveBeenCalledWith({
      status: 'disabled',
      reason: 'OTEL fuer dieses Laufzeitprofil deaktiviert.',
    });
  });

  it('starts monitoring, stores the sdk and flushes the logger provider', async () => {
    const forceFlush = vi.fn().mockResolvedValue(undefined);
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const sdk = { shutdown, loggerProvider: { forceFlush } };
    const processOn = vi.spyOn(process, 'on').mockReturnValue(process);
    const { module, setOtelInitializationResult, setWorkspaceContextGetter, startOtelSdk } = await importBootstrap({
      startOtelSdk: vi.fn().mockResolvedValue(sdk),
    });

    vi.stubEnv('OTEL_SERVICE_NAME', 'server-runtime-test');
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel.example');

    const result = await module.initializeOtelSdk();
    await module.flushOtelSdk(1234);

    expect(result).toEqual({ status: 'ready', sdk });
    expect(setWorkspaceContextGetter).toHaveBeenCalledWith(expect.any(Function));
    expect(startOtelSdk).toHaveBeenCalledWith({
      serviceName: 'server-runtime-test',
      environment: process.env.NODE_ENV ?? 'development',
      otlpEndpoint: 'http://otel.example',
    });
    expect(setOtelInitializationResult).toHaveBeenCalledWith({ status: 'ready', sdk });
    expect(forceFlush).toHaveBeenCalledWith(1234);
    expect(processOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('returns failed initialization when optional otel startup fails', async () => {
    const { module, setOtelInitializationResult } = await importBootstrap({
      startOtelSdk: vi.fn().mockRejectedValue(new Error('collector unavailable')),
    });

    await expect(module.initializeOtelSdk()).resolves.toEqual({
      status: 'failed',
      reason: 'collector unavailable',
    });

    expect(setOtelInitializationResult).toHaveBeenCalledWith({
      status: 'failed',
      reason: 'collector unavailable',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Fehler beim Initialisieren des OTEL SDK',
      expect.objectContaining({ error: 'collector unavailable' })
    );
  });

  it('throws startup failures when otel is required', async () => {
    const error = new Error('collector required');
    const { module } = await importBootstrap({
      runtimeConfig: {
        environment: 'production',
        consoleEnabled: false,
        uiEnabled: false,
        otelRequired: true,
      },
      startOtelSdk: vi.fn().mockRejectedValue(error),
    });

    await expect(module.initializeOtelSdk()).rejects.toThrow(error);
  });
});
