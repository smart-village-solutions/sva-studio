import {
  BULK_RATE_LIMIT,
  READ_RATE_LIMIT,
  RATE_WINDOW_MS,
  WRITE_RATE_LIMIT,
} from '../iam-account-management/constants.js';
import type { RateBucket, RateScope } from '../iam-account-management/types.js';

import { createApiError } from './request-helpers.js';

const rateLimiterStore = new Map<string, RateBucket>();
const RATE_WINDOW_SECONDS = RATE_WINDOW_MS / 1000;

const pruneExpiredBuckets = (now: number): void => {
  for (const [key, bucket] of rateLimiterStore.entries()) {
    if (now - bucket.windowStartedAt >= RATE_WINDOW_MS) {
      rateLimiterStore.delete(key);
    }
  }
};

export const consumeRateLimit = (
  input: { instanceId: string; actorKeycloakSubject: string; scope: RateScope; requestId?: string } & {
    now?: number;
  }
): Response | null => {
  const limit = input.scope === 'read' ? READ_RATE_LIMIT : input.scope === 'bulk' ? BULK_RATE_LIMIT : WRITE_RATE_LIMIT;
  const now = input.now ?? Date.now();
  pruneExpiredBuckets(now);
  const key = `${input.instanceId}:${input.actorKeycloakSubject}:${input.scope}`;
  const existing = rateLimiterStore.get(key);
  if (!existing || now - existing.windowStartedAt >= RATE_WINDOW_MS) {
    rateLimiterStore.set(key, { windowStartedAt: now, count: 1 });
    return null;
  }

  if (existing.count >= limit) {
    return createApiError(
      429,
      'rate_limited',
      'Rate limit überschritten.',
      input.requestId,
      { scope: input.scope, limit, windowSeconds: RATE_WINDOW_SECONDS }
    );
  }

  existing.count += 1;
  rateLimiterStore.set(key, existing);
  return null;
};
