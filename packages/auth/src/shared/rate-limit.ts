import {
  BULK_RATE_LIMIT,
  READ_RATE_LIMIT,
  RATE_WINDOW_MS,
  WRITE_RATE_LIMIT,
} from '../iam-account-management/constants.js';
import type { RateBucket, RateScope } from '../iam-account-management/types.js';

import { createApiError } from './request-helpers.js';

const RATE_WINDOW_SECONDS = RATE_WINDOW_MS / 1000;
const MAX_RATE_BUCKETS = 10_000;

type ConsumeRateLimitInput = {
  instanceId: string;
  actorKeycloakSubject: string;
  scope: RateScope;
  requestId?: string;
  now?: number;
};

const resolveRateLimit = (scope: RateScope): number => {
  if (scope === 'read') {
    return READ_RATE_LIMIT;
  }

  if (scope === 'bulk') {
    return BULK_RATE_LIMIT;
  }

  return WRITE_RATE_LIMIT;
};

const createRateLimitPruner = (
  rateLimiterStore: Map<string, RateBucket>,
  maxRateBuckets: number
) => (now: number): void => {
  for (const [key, bucket] of rateLimiterStore.entries()) {
    if (now - bucket.windowStartedAt >= RATE_WINDOW_MS) {
      rateLimiterStore.delete(key);
    }
  }

  while (rateLimiterStore.size > maxRateBuckets) {
    const oldestKey = rateLimiterStore.keys().next().value;
    if (!oldestKey) {
      break;
    }
    rateLimiterStore.delete(oldestKey);
  }
};

export const createRateLimitConsumer = (
  input: {
    readonly maxBuckets?: number;
  } = {}
) => {
  const rateLimiterStore = new Map<string, RateBucket>();
  const pruneExpiredBuckets = createRateLimitPruner(rateLimiterStore, input.maxBuckets ?? MAX_RATE_BUCKETS);

  return (
    consumeInput: ConsumeRateLimitInput
  ): Response | null => {
    const limit = resolveRateLimit(consumeInput.scope);
    const now = consumeInput.now ?? Date.now();
    pruneExpiredBuckets(now);
    const key = `${consumeInput.instanceId}:${consumeInput.actorKeycloakSubject}:${consumeInput.scope}`;
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
        consumeInput.requestId,
        { scope: consumeInput.scope, limit, windowSeconds: RATE_WINDOW_SECONDS }
      );
    }

    existing.count += 1;
    rateLimiterStore.set(key, existing);
    return null;
  };
};

export const consumeRateLimit = createRateLimitConsumer();
