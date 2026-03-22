import { describe } from 'vitest';

import { closeRedis, getLastRedisError, isRedisAvailable } from './redis.server';

const redisAvailable = await isRedisAvailable().catch(() => false);

if (!redisAvailable) {
  const lastError = getLastRedisError();
  console.warn(
    `[auth:test:unit] Skipping Redis-dependent tests because Redis is unavailable${lastError ? `: ${lastError}` : ''}`
  );
  await closeRedis().catch(() => undefined);
}

export const describeIfRedisAvailable = ((title: string, factory: Parameters<typeof describe>[1]) =>
  redisAvailable ? describe(title, factory) : describe.skip(title, factory)) as typeof describe;
