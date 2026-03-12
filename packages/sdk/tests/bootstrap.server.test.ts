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

  it('does not initialize OTEL in production when ENABLE_OTEL=false is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_OTEL = 'false';

    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    const result = await initializeOtelSdk();

    expect(result).toBeNull();
    expect(setWorkspaceContextGetterForMonitoring).not.toHaveBeenCalled();
    expect(startOtelSdkFromMonitoring).not.toHaveBeenCalled();
  });

  it('initializes OTEL in production when ENABLE_OTEL is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_OTEL;

    const { initializeOtelSdk } = await import('../src/server/bootstrap.server');
    await initializeOtelSdk();

    expect(setWorkspaceContextGetterForMonitoring).toHaveBeenCalledTimes(1);
    expect(startOtelSdkFromMonitoring).toHaveBeenCalledTimes(1);
  });
});
