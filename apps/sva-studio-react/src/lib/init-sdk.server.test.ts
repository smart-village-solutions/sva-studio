import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
};

const createSdkLogger = vi.fn(() => logger);
const getInstanceConfig = vi.fn();
const initializeOtelSdk = vi.fn();

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger,
  getInstanceConfig,
  initializeOtelSdk,
}));

const loadModule = async () => import('./init-sdk.server');

describe('ensureSdkInitialized', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS;
    getInstanceConfig.mockReset();
    initializeOtelSdk.mockReset();
  });

  it('initializes the SDK once and skips repeated calls after success', async () => {
    getInstanceConfig.mockReturnValue(null);
    initializeOtelSdk.mockResolvedValue(undefined);

    const { ensureSdkInitialized } = await loadModule();

    await ensureSdkInitialized();
    await ensureSdkInitialized();

    expect(createSdkLogger).toHaveBeenCalledTimes(1);
    expect(getInstanceConfig).toHaveBeenCalledTimes(1);
    expect(initializeOtelSdk).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('SDK initialisiert');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('rethrows invalid instance-config errors and retries on the next call', async () => {
    getInstanceConfig.mockImplementationOnce(() => {
      throw new Error('invalid instance config');
    });
    getInstanceConfig.mockReturnValueOnce(null);
    initializeOtelSdk.mockResolvedValue(undefined);

    const { ensureSdkInitialized } = await loadModule();

    await expect(ensureSdkInitialized()).rejects.toThrow('invalid instance config');
    await ensureSdkInitialized();

    expect(getInstanceConfig).toHaveBeenCalledTimes(2);
    expect(initializeOtelSdk).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'SDK-Initialisierung wegen ungültiger Instance-Konfiguration abgebrochen',
      expect.objectContaining({
        error: 'invalid instance config',
        error_type: 'Error',
      })
    );
  });

  it('logs initialization failures without throwing and retries later', async () => {
    getInstanceConfig.mockReturnValue(null);
    initializeOtelSdk.mockRejectedValueOnce(new Error('otel down'));
    initializeOtelSdk.mockResolvedValueOnce(undefined);

    const { ensureSdkInitialized } = await loadModule();

    await expect(ensureSdkInitialized()).resolves.toBeUndefined();
    await expect(ensureSdkInitialized()).resolves.toBeUndefined();

    expect(getInstanceConfig).toHaveBeenCalledTimes(2);
    expect(initializeOtelSdk).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      'SDK-Initialisierung fehlgeschlagen',
      expect.objectContaining({
        error: 'otel down',
        error_type: 'Error',
      })
    );
    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});
