import { describe, expect, it, vi } from 'vitest';

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
    connect: vi.fn(async () => ({
      query,
      release,
    })),
    release,
  };
};

describe('instance id resolution', () => {
  it('logs database failures before returning database_unavailable', async () => {
    const failingPool = createPool(vi.fn().mockRejectedValueOnce(new Error('database down')));

    await expect(resolveInstanceId({ resolvePool: () => failingPool, candidate: 'tenant-a' })).resolves.toEqual({
      ok: false,
      reason: 'database_unavailable',
    });

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Instance ID resolution failed',
      expect.objectContaining({
        candidate: 'tenant-a',
        reason_code: 'instance_id_resolution_failed',
        error_type: 'Error',
      })
    );
    expect(failingPool.release).toHaveBeenCalledWith();
  });

  it('rejects missing or blank instance candidates before touching the database', async () => {
    const resolvePool = vi.fn(() => null);

    await expect(resolveInstanceId({ resolvePool, candidate: '  ' })).resolves.toEqual({
      ok: false,
      reason: 'missing_instance',
    });

    expect(resolvePool).not.toHaveBeenCalled();
  });

  it('trusts the trimmed candidate when no database pool is available', async () => {
    await expect(resolveInstanceId({ resolvePool: () => null, candidate: ' tenant-a ' })).resolves.toEqual({
      ok: true,
      instanceId: 'tenant-a',
      fromInstanceKey: false,
      created: false,
    });
  });

  it('returns an existing database instance and releases the client', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'tenant-a' }] });
    const pool = createPool(query);

    await expect(resolveInstanceId({ resolvePool: () => pool, candidate: 'tenant-a' })).resolves.toEqual({
      ok: true,
      instanceId: 'tenant-a',
      fromInstanceKey: false,
      created: false,
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledWith();
  });

  it('can create missing instances from trusted keys', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tenant-new' }] });
    const pool = createPool(query);

    await expect(
      resolveInstanceId({
        resolvePool: () => pool,
        candidate: 'tenant-new',
        createIfMissingFromKey: true,
        displayNameForCreate: 'Tenant New',
      })
    ).resolves.toEqual({
      ok: true,
      instanceId: 'tenant-new',
      fromInstanceKey: false,
      created: true,
    });

    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO iam.instances'), [
      'tenant-new',
      'Tenant New',
    ]);
    expect(pool.release).toHaveBeenCalledWith();
  });

  it('reports invalid instances and database failures', async () => {
    const missingQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveInstanceId({ resolvePool: () => createPool(missingQuery), candidate: 'unknown' })
    ).resolves.toEqual({ ok: false, reason: 'invalid_instance' });

    const failingPool = createPool(vi.fn().mockRejectedValueOnce(new Error('database down')));
    await expect(resolveInstanceId({ resolvePool: () => failingPool, candidate: 'tenant-a' })).resolves.toEqual({
      ok: false,
      reason: 'database_unavailable',
    });
    expect(failingPool.release).toHaveBeenCalledWith();
  });
});
