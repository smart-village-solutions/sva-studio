import { describe, expect, it } from 'vitest';

describe('rate limit consumer', () => {
  it('creates and resets buckets once the rate window has elapsed', async () => {
    const { createRateLimitConsumer } = await import('./rate-limit.js');

    const consume = createRateLimitConsumer();
    const first = consume({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'actor-1',
      scope: 'write',
      now: 1_000,
    });
    const second = consume({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'actor-1',
      scope: 'write',
      now: 61_000,
    });

    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it('returns a 429 response with bulk rate-limit diagnostics after the limit is exceeded', async () => {
    const { createRateLimitConsumer } = await import('./rate-limit.js');

    const consume = createRateLimitConsumer();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-1',
        scope: 'bulk',
        requestId: 'req-1',
        now: 10_000,
      })
    ).toBeNull();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-1',
        scope: 'bulk',
        requestId: 'req-1',
        now: 10_001,
      })
    ).toBeNull();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-1',
        scope: 'bulk',
        requestId: 'req-1',
        now: 10_002,
      })
    ).toBeNull();

    const response = consume({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'actor-1',
      scope: 'bulk',
      requestId: 'req-1',
      now: 10_003,
    });

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'rate_limited',
        details: {
          scope: 'bulk',
          limit: 3,
          windowSeconds: 60,
        },
      },
      requestId: 'req-1',
    });
  });

  it('prunes expired buckets before enforcing the max bucket count', async () => {
    const { createRateLimitConsumer } = await import('./rate-limit.js');

    const consume = createRateLimitConsumer({ maxBuckets: 2 });
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-1',
        scope: 'read',
        now: 1_000,
      })
    ).toBeNull();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-2',
        scope: 'read',
        now: 1_100,
      })
    ).toBeNull();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-3',
        scope: 'read',
        now: 61_500,
      })
    ).toBeNull();

    const recycled = consume({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'actor-1',
      scope: 'read',
      now: 61_600,
    });

    expect(recycled).toBeNull();
  });

  it('evicts the oldest active bucket when the store grows past max buckets', async () => {
    const { createRateLimitConsumer } = await import('./rate-limit.js');

    const consume = createRateLimitConsumer({ maxBuckets: 1 });
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-1',
        scope: 'write',
        now: 5_000,
      })
    ).toBeNull();
    expect(
      consume({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'actor-2',
        scope: 'write',
        now: 5_001,
      })
    ).toBeNull();

    const response = consume({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'actor-1',
      scope: 'write',
      now: 5_002,
    });

    expect(response).toBeNull();
  });
});
