import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const closeRedisMock = vi.fn();
const getLastRedisErrorMock = vi.fn();
const isRedisAvailableMock = vi.fn();

const loadGuard = async () => {
  vi.resetModules();
  vi.doMock('./redis.server.js', () => ({
    closeRedis: closeRedisMock,
    getLastRedisError: getLastRedisErrorMock,
    isRedisAvailable: isRedisAvailableMock,
  }));
  return import('../test-utils/redis-test-guard.js');
};

describe('ensureRedisAvailabilityChecked', () => {
  beforeEach(() => {
    closeRedisMock.mockReset();
    getLastRedisErrorMock.mockReset();
    isRedisAvailableMock.mockReset();
    delete process.env.TEST_REDIS_GUARD_LOG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches a successful availability check', async () => {
    const { ensureRedisAvailabilityChecked } = await loadGuard();
    isRedisAvailableMock.mockResolvedValue(true);

    await expect(ensureRedisAvailabilityChecked()).resolves.toBe(true);
    await expect(ensureRedisAvailabilityChecked()).resolves.toBe(true);

    expect(isRedisAvailableMock).toHaveBeenCalledTimes(1);
    expect(closeRedisMock).not.toHaveBeenCalled();
  });

  it('logs and closes redis when availability checks fail', async () => {
    process.env.TEST_REDIS_GUARD_LOG = '1';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ensureRedisAvailabilityChecked } = await loadGuard();
    isRedisAvailableMock.mockImplementation(() => Promise.reject(new Error('redis down')));
    getLastRedisErrorMock.mockReturnValue('ENOTFOUND redis');

    await expect(ensureRedisAvailabilityChecked()).resolves.toBe(false);

    expect(closeRedisMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[auth:test:unit] Skipping Redis-dependent tests because Redis is unavailable: ENOTFOUND redis'
    );
  });
});
