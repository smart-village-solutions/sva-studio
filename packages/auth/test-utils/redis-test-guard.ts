import { closeRedis, getLastRedisError, isRedisAvailable } from '../src/redis.server.js';

let redisAvailable: boolean | undefined;

export const ensureRedisAvailabilityChecked = async (): Promise<boolean> => {
  if (redisAvailable !== undefined) {
    return redisAvailable;
  }

  redisAvailable = await Promise.resolve(isRedisAvailable()).catch(() => false);
  if (!redisAvailable) {
    const lastError = getLastRedisError();
    if (process.env.TEST_REDIS_GUARD_LOG === '1') {
      const errorSuffix = lastError ? `: ${lastError}` : '';
      console.warn(
        `[auth:test:unit] Skipping Redis-dependent tests because Redis is unavailable${errorSuffix}`
      );
    }
    await Promise.resolve(closeRedis()).catch(() => undefined);
  }

  return redisAvailable;
};
