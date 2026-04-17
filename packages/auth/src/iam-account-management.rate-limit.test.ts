import { describe, expect, it } from 'vitest';

import { RATE_WINDOW_MS, WRITE_RATE_LIMIT } from './iam-account-management/constants';
import { consumeRateLimit } from './iam-account-management/rate-limit';
import { createRateLimitConsumer } from './shared/rate-limit';

describe('consumeRateLimit', () => {
  it('reports the configured window in seconds', async () => {
    const actorKeycloakSubject = `rate-limit-window-${Date.now()}`;
    const input = {
      instanceId: 'de-musterhausen',
      actorKeycloakSubject,
      scope: 'write' as const,
      requestId: 'req-rate-limit-window',
      now: 10_000,
    };

    for (let index = 0; index < WRITE_RATE_LIMIT; index += 1) {
      expect(consumeRateLimit(input)).toBeNull();
    }

    const response = consumeRateLimit(input);
    expect(response?.status).toBe(429);
    expect(response).not.toBeNull();
    if (!response) {
      throw new Error('Rate limit response erwartet.');
    }

    const payload = (await response.json()) as {
      error: { details?: { windowSeconds?: number } };
    };
    expect(payload.error.details?.windowSeconds).toBe(RATE_WINDOW_MS / 1000);
  });

  it('starts a new bucket after the configured time window', () => {
    const actorKeycloakSubject = `rate-limit-reset-${Date.now()}`;
    const blockedInput = {
      instanceId: 'de-musterhausen',
      actorKeycloakSubject,
      scope: 'write' as const,
      now: 20_000,
    };

    for (let index = 0; index < WRITE_RATE_LIMIT; index += 1) {
      expect(consumeRateLimit(blockedInput)).toBeNull();
    }

    expect(consumeRateLimit(blockedInput)?.status).toBe(429);
    expect(
      consumeRateLimit({
        ...blockedInput,
        now: blockedInput.now + RATE_WINDOW_MS + 1,
      })
    ).toBeNull();
  });

  it('evicts the oldest bucket when the in-memory cap is exceeded', () => {
    const consumeWithSmallCap = createRateLimitConsumer({ maxBuckets: 3 });
    const now = 30_000;
    const oldestActor = 'rate-limit-oldest';

    for (let index = 0; index < WRITE_RATE_LIMIT; index += 1) {
      expect(
        consumeWithSmallCap({
          instanceId: 'de-musterhausen',
          actorKeycloakSubject: oldestActor,
          scope: 'write',
          now,
        })
      ).toBeNull();
    }

    for (const actorKeycloakSubject of ['rate-limit-cap-a', 'rate-limit-cap-b', 'rate-limit-cap-c']) {
      expect(
        consumeWithSmallCap({
          instanceId: 'de-musterhausen',
          actorKeycloakSubject,
          scope: 'read',
          now,
        })
      ).toBeNull();
    }

    // Der älteste Bucket wird beim Überschreiten des Caps entfernt und beginnt wieder bei count=1.
    expect(
      consumeWithSmallCap({
        instanceId: 'de-musterhausen',
        actorKeycloakSubject: oldestActor,
        scope: 'write',
        now,
      })
    ).toBeNull();
  });
});
