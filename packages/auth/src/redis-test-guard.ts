import { closeRedis, getLastRedisError, isRedisAvailable } from './redis.server.js';

let redisAvailable: boolean | undefined;

export const ensureRedisAvailabilityChecked = async (): Promise<boolean> => {
  if (redisAvailable !== undefined) {
    return redisAvailable;
  }

  redisAvailable = await isRedisAvailable().catch(() => false);
  if (!redisAvailable) {
    const lastError = getLastRedisError();
    if (process.env.TEST_REDIS_GUARD_LOG === '1') {
      console.warn(
        `[auth:test:unit] Skipping Redis-dependent tests because Redis is unavailable${lastError ? `: ${lastError}` : ''}`
      );
    }
    await closeRedis().catch(() => undefined);
  }

  return redisAvailable;
};
