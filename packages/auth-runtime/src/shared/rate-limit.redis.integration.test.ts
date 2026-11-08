import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { consumeGeocodingBudget } from './rate-limit.js';

const redisUrl = process.env.GEOCODING_TEST_REDIS_URL;
describe.skipIf(!redisUrl)('shared geocoding Redis budget', () => {
  const clients = redisUrl ? [new Redis(redisUrl), new Redis(redisUrl)] : [];
  const instanceId = `owasp-test-${randomUUID()}`;
  const key = `geocoding-rate-limit:${instanceId}`;
  afterAll(async () => {
    await clients[0]?.del(key, `${key}-other`);
    await Promise.all(clients.map((client) => client.quit()));
  });
  it('atomically shares the limit, isolates tenants, preserves expiry on rejection and resets after expiry', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        consumeGeocodingBudget({ instanceId, limit: 7 }, clients[index % 2])
      )
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(7);
    expect(results.filter((result) => !result.allowed)).toHaveLength(23);
    expect(
      await consumeGeocodingBudget({ instanceId: `${instanceId}-other`, limit: 7 }, clients[1])
    ).toEqual({ allowed: true });
    const ttlBefore = await clients[0].pttl(key);
    expect(ttlBefore).toBeGreaterThan(0);
    expect(ttlBefore).toBeLessThanOrEqual(60_000);
    expect(await consumeGeocodingBudget({ instanceId, limit: 7 }, clients[1])).toMatchObject({
      allowed: false,
      retryAfterSeconds: expect.any(Number),
    });
    expect(await clients[0].pttl(key)).toBeLessThanOrEqual(ttlBefore);
    await clients[0].pexpire(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await consumeGeocodingBudget({ instanceId, limit: 7 }, clients[1])).toEqual({
      allowed: true,
    });
  });
});
