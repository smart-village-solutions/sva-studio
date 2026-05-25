import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  runMigrations: vi.fn(),
  run: vi.fn(),
  resolvePool: vi.fn(),
  createPoolResolver: vi.fn(() => vi.fn(() => null)),
  withResolvedInstanceDb: vi.fn(),
  bootstrapStudioAppDbUserIfNeeded: vi.fn(),
  createSdkLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

vi.mock('graphile-worker', () => ({
  runMigrations: state.runMigrations,
  run: state.run,
}));

vi.mock('../db.js', () => ({
  resolvePool: state.resolvePool,
  createPoolResolver: state.createPoolResolver,
  withResolvedInstanceDb: state.withResolvedInstanceDb,
}));

vi.mock('../postgres-app-user-bootstrap.js', () => ({
  bootstrapStudioAppDbUserIfNeeded: state.bootstrapStudioAppDbUserIfNeeded,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
}));

describe('plugin operation worker bootstrap recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.resolvePool.mockReturnValue({ pool: 'pg' });
    state.bootstrapStudioAppDbUserIfNeeded.mockResolvedValue(false);
    state.run.mockResolvedValue({
      stop: vi.fn(),
      addJob: vi.fn(),
    });
  });

  it('retries worker startup once after bootstrapping local app-db privileges', async () => {
    state.runMigrations
      .mockRejectedValueOnce(new Error('permission denied for database sva_studio'))
      .mockResolvedValueOnce(undefined);
    state.bootstrapStudioAppDbUserIfNeeded.mockResolvedValue(true);

    const { ensurePluginOperationWorkerStarted } = await import('./runner.js');

    await expect(ensurePluginOperationWorkerStarted()).resolves.toBeUndefined();

    expect(state.bootstrapStudioAppDbUserIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'permission denied for database sva_studio',
      })
    );
    expect(state.runMigrations).toHaveBeenCalledTimes(2);
    expect(state.run).toHaveBeenCalledTimes(1);
  }, 15_000);
});
