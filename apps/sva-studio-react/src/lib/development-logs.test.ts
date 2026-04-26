import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLoggingRuntimeConfig = vi.fn();
const readDevelopmentLogEntries = vi.fn();

vi.mock('@sva/server-runtime', () => ({
  getLoggingRuntimeConfig,
  readDevelopmentLogEntries,
}));

describe('readDevelopmentServerLogs', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns no entries when the development UI is disabled', async () => {
    getLoggingRuntimeConfig.mockReturnValue({
      environment: 'production',
      consoleEnabled: false,
      uiEnabled: false,
      otelRequested: true,
      otelRequired: true,
    });

    const { readDevelopmentServerLogs } = await import('./development-logs');

    await expect(readDevelopmentServerLogs({ afterId: 12 })).resolves.toEqual([]);
    expect(readDevelopmentLogEntries).not.toHaveBeenCalled();
  });

  it('loads redacted server entries in development mode', async () => {
    getLoggingRuntimeConfig.mockReturnValue({
      environment: 'development',
      consoleEnabled: true,
      uiEnabled: true,
      otelRequested: true,
      otelRequired: false,
    });
    readDevelopmentLogEntries.mockReturnValue([
      {
        id: 13,
        timestamp: '2026-03-25T12:00:00.000Z',
        source: 'server',
        level: 'error',
        message: 'server exploded',
      },
    ]);

    const { readDevelopmentServerLogs } = await import('./development-logs');

    await expect(readDevelopmentServerLogs({ afterId: 12 })).resolves.toEqual([
      expect.objectContaining({
        id: 13,
        message: 'server exploded',
      }),
    ]);
    expect(readDevelopmentLogEntries).toHaveBeenCalledWith({ afterId: 12 });
  });

  it('forwards an empty query object when no cursor is provided', async () => {
    getLoggingRuntimeConfig.mockReturnValue({
      environment: 'development',
      consoleEnabled: true,
      uiEnabled: true,
      otelRequested: true,
      otelRequired: false,
    });
    readDevelopmentLogEntries.mockReturnValue([]);

    const { readDevelopmentServerLogs } = await import('./development-logs');

    await expect(readDevelopmentServerLogs()).resolves.toEqual([]);
    expect(readDevelopmentLogEntries).toHaveBeenCalledWith({ afterId: undefined });
  });
});
