import { describe, expect, it } from 'vitest';

import { consumeRateLimit } from './rate-limit.js';

describe('shared/rate-limit', () => {
  it('allows requests within the window and blocks once the limit is exceeded', async () => {
    const now = Date.now();
    const input = {
      instanceId: `rate-limit-${now}`,
      actorKeycloakSubject: 'user-1',
      scope: 'read' as const,
      requestId: 'req-1',
      now,
    };

    expect(consumeRateLimit(input)).toBeNull();

    let blocked: Response | null = null;
    for (let index = 0; index < 60; index += 1) {
      blocked = consumeRateLimit(input);
      if (blocked) {
        break;
      }
    }

    expect(blocked?.status).toBe(429);
    await expect(blocked?.json()).resolves.toMatchObject({
      error: { code: 'rate_limited' },
    });
  });
});
