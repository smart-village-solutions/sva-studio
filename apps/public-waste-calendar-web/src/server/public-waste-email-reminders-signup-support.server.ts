import { createHash, randomBytes } from 'node:crypto';
import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import type { WasteEmailReminderPendingSignupInput } from '@sva/waste-management-runtime/repositories';
import type { PublicWasteRepository } from '../lib/public-waste-repository.server.js';
import type { PublicWasteReminderSignupRequest } from '../lib/public-waste-contract.js';

type SelectionSummaryRepository = Pick<PublicWasteRepository, 'loadSelectionSummary'>;

type ReminderSignupPersistence = (input: WasteEmailReminderPendingSignupInput) => Promise<void>;
type ReminderSignupWithLimitCheckPersistence = (input: {
  readonly signup: WasteEmailReminderPendingSignupInput;
  readonly maxSubscriptionsPerEmailAndLocation: number;
}) => Promise<'created' | 'subscription_limit_reached'>;
type ReminderSubscriptionCounter = (input: {
  readonly emailHash: string;
  readonly selection: WasteEmailReminderPendingSignupInput['selection'];
}) => Promise<number>;

export type ReminderSignupInput = Readonly<{
  request: Request;
  payload: PublicWasteReminderSignupRequest;
  reminderConfig: WasteManagementEmailReminderConfig;
  repository: SelectionSummaryRepository;
}>;

export type ReminderSignupDependencies = Readonly<{
  persistPendingSignup: ReminderSignupPersistence;
  persistPendingSignupWithLimitCheck?: ReminderSignupWithLimitCheckPersistence;
  countExistingSubscriptions?: ReminderSubscriptionCounter;
  now?: () => Date;
  createId?: () => string;
  createToken?: () => string;
  hashValue?: (value: string) => string;
  consumeRateLimit?: (input: {
    readonly key: string;
    readonly limit: number;
    readonly windowMs: number;
    readonly now: number;
  }) => Readonly<{ retryAfterSeconds: number }> | null;
}>;

const SIGNUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const TOO_MANY_REQUESTS_MESSAGE =
  'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.';
const SUBSCRIPTION_LIMIT_REACHED_MESSAGE =
  'Für diese E-Mail-Adresse und diesen Standort wurde die maximale Anzahl an Erinnerungen bereits eingerichtet.';

type PublicWasteReminderSignupErrorCode = 'rate_limited' | 'subscription_limit_reached';

export class PublicWasteReminderSignupError extends Error {
  readonly code: PublicWasteReminderSignupErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    readonly code: PublicWasteReminderSignupErrorCode;
    readonly message: string;
    readonly status: number;
    readonly retryAfterSeconds?: number;
  }) {
    super(input.message);
    this.name = 'PublicWasteReminderSignupError';
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export const createSha256Hash = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const sha256HashPattern = /^sha256:[0-9a-f]{64}$/i;
export const createOpaqueToken = (): string => randomBytes(32).toString('base64url');
export const toIsoString = (value: Date): string => value.toISOString();

export const normalizeBearerTokenToHash = (
  token: string,
  hashValue: (value: string) => string
): string => (sha256HashPattern.test(token) ? token.toLowerCase() : hashValue(token));
const resolveRequestIp = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }
  return 'unknown';
};

export const createReminderRateLimitConsumer = () => {
  const buckets = new Map<string, { windowStartedAt: number; count: number }>();
  return (input: {
    readonly key: string;
    readonly limit: number;
    readonly windowMs: number;
    readonly now: number;
  }): Readonly<{ retryAfterSeconds: number }> | null => {
    if (input.limit <= 0) {
      return null;
    }
    for (const [key, bucket] of buckets.entries()) {
      if (input.now - bucket.windowStartedAt >= input.windowMs) {
        buckets.delete(key);
      }
    }
    const existing = buckets.get(input.key);
    if (!existing || input.now - existing.windowStartedAt >= input.windowMs) {
      buckets.set(input.key, { windowStartedAt: input.now, count: 1 });
      return null;
    }
    if (existing.count >= input.limit) {
      const elapsedMs = input.now - existing.windowStartedAt;
      const retryAfterSeconds = Math.max(1, Math.ceil((input.windowMs - elapsedMs) / 1000));
      return { retryAfterSeconds };
    }
    existing.count += 1;
    buckets.set(input.key, existing);
    return null;
  };
};
const assertReminderSignupRateLimit = (
  consumeRateLimit: NonNullable<ReminderSignupDependencies['consumeRateLimit']>,
  input: {
    readonly key: string;
    readonly limit: number;
    readonly now: number;
  }
): void => {
  const rateLimit = consumeRateLimit({
    ...input,
    windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
  });
  if (rateLimit) {
    throw new PublicWasteReminderSignupError({
      code: 'rate_limited',
      message: TOO_MANY_REQUESTS_MESSAGE,
      status: 429,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }
};

export const enforceReminderSignupRateLimits = (input: {
  readonly consumeRateLimit: ReminderSignupDependencies['consumeRateLimit'];
  readonly request: Request;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
  readonly emailHash: string;
  readonly now: number;
}): void => {
  if (!input.consumeRateLimit) {
    return;
  }
  assertReminderSignupRateLimit(input.consumeRateLimit, {
    key: `ip:${resolveRequestIp(input.request)}`,
    limit: input.reminderConfig.signupRateLimitPerIpPerHour,
    now: input.now,
  });
  assertReminderSignupRateLimit(input.consumeRateLimit, {
    key: `email:${input.emailHash}`,
    limit: input.reminderConfig.signupRateLimitPerEmailPerHour,
    now: input.now,
  });
};
