import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

import { resolveInstanceId } from './instance-id-resolution.js';

const createPool = (query: ReturnType<typeof vi.fn>) => {
  const release = vi.fn();
  return {
    connect: vi.fn(async () => ({ query, release })),
    release,
  };
};

describe('shared resolveInstanceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing candidates and trusts candidates when no pool exists', async () => {
    await expect(resolveInstanceId({ resolvePool: () => null, candidate: '   ' })).resolves.toEqual({
      ok: false,
      reason: 'missing_instance',
    });
    await expect(resolveInstanceId({ resolvePool: () => null, candidate: 'instance-1' })).resolves.toEqual({
      ok: true,
      instanceId: 'instance-1',
      fromInstanceKey: false,
      created: false,
    });
  });

  it('returns existing instances, creates missing instances and releases clients', async () => {
    const existingQuery = vi.fn(async () => ({ rows: [{ id: 'instance-1' }] }));
    const existingPool = createPool(existingQuery);

    await expect(resolveInstanceId({ resolvePool: () => existingPool as never, candidate: 'instance-1' })).resolves
      .toEqual({
        ok: true,
        instanceId: 'instance-1',
        fromInstanceKey: false,
        created: false,
      });
    expect(existingPool.release).toHaveBeenCalledTimes(1);

    const createQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'instance-2' }] });
    const createPoolResult = createPool(createQuery);

    await expect(
      resolveInstanceId({
        resolvePool: () => createPoolResult as never,
        candidate: 'instance-2',
        createIfMissingFromKey: true,
        displayNameForCreate: 'Instance 2',
      })
    ).resolves.toEqual({
      ok: true,
      instanceId: 'instance-2',
      fromInstanceKey: false,
      created: true,
    });
    expect(createPoolResult.release).toHaveBeenCalledTimes(1);
  });

  it('reports invalid and unavailable database states', async () => {
    const missingQuery = vi.fn(async () => ({ rows: [] }));
    await expect(resolveInstanceId({ resolvePool: () => createPool(missingQuery) as never, candidate: 'missing' }))
      .resolves.toEqual({
        ok: false,
        reason: 'invalid_instance',
      });

    const emptyInsertQuery = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveInstanceId({
        resolvePool: () => createPool(emptyInsertQuery) as never,
        candidate: 'missing',
        createIfMissingFromKey: true,
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid_instance',
    });

    const throwingQuery = vi.fn(async () => {
      throw new Error('db down');
    });
    await expect(resolveInstanceId({ resolvePool: () => createPool(throwingQuery) as never, candidate: 'instance-1' }))
      .resolves.toEqual({
        ok: false,
        reason: 'database_unavailable',
      });
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Shared instance ID resolution failed',
      expect.objectContaining({
        candidate: 'instance-1',
        reason_code: 'instance_id_resolution_failed',
        error_type: 'Error',
      })
    );
  });
});
