import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { MailDispatchPayload, WasteManagementEmailReminderConfig } from '@sva/core';
import type {
  WasteEmailReminderActivationResult,
  WasteEmailReminderPendingSignupInput,
  WasteEmailReminderUnsubscribeSubscription,
  WasteEmailReminderUnsubscribeResult,
} from '@sva/data-repositories';
import {
  readWasteManagementUnsubscribeTokenSubscriptionId,
  verifyWasteManagementUnsubscribeToken,
} from '@sva/waste-management-contracts/unsubscribe-token';
import type { PublicWasteRepository } from '../lib/public-waste-repository.server.js';
import type {
  PublicWasteReminderSignupRequest,
  PublicWasteReminderSignupResponse,
} from '../lib/public-waste-contract.js';

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

type ReminderSignupInput = Readonly<{
  request: Request;
  payload: PublicWasteReminderSignupRequest;
  reminderConfig: WasteManagementEmailReminderConfig;
  repository: SelectionSummaryRepository;
}>;

type ReminderSignupDependencies = Readonly<{
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

type ReminderTokenActionDependencies = Readonly<{
  activateByDoiTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderActivationResult>;
  loadUnsubscribeSubscriptionById: (input: {
    readonly subscriptionId: string;
  }) => Promise<WasteEmailReminderUnsubscribeSubscription | null>;
  unsubscribeByTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderUnsubscribeResult>;
  now?: () => Date;
  hashValue?: (value: string) => string;
}>;

type ReminderPageInput = Readonly<{
  request: Request;
  pathname: string;
  reminderConfig: WasteManagementEmailReminderConfig;
  unsubscribeTokenSecret: string;
}>;

const DEFAULT_PENDING_HEADLINE = 'Bestätigungslink versendet';
const DEFAULT_PENDING_MESSAGE =
  'Bitte prüfen Sie Ihr E-Mail-Postfach und bestätigen Sie die Anmeldung über den enthaltenen Link.';
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

const createSha256Hash = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const sha256HashPattern = /^sha256:[0-9a-f]{64}$/i;
const createOpaqueToken = (): string => randomBytes(32).toString('base64url');
const addHours = (value: Date, hours: number): Date =>
  new Date(value.getTime() + hours * 60 * 60 * 1000);
const toIsoString = (value: Date): string => value.toISOString();

const buildPublicUrl = (
  baseUrl: string,
  path: string,
  params: Readonly<Record<string, string>> = {}
): string => {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeBearerTokenToHash = (token: string, hashValue: (value: string) => string): string =>
  sha256HashPattern.test(token) ? token.toLowerCase() : hashValue(token);
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

const createReminderRateLimitConsumer = () => {
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
const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildStatusPageResponse = (input: {
  readonly title: string;
  readonly headline: string;
  readonly body: string;
}): Response =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head><body><main><h1>${escapeHtml(input.headline)}</h1><p>${escapeHtml(input.body)}</p></main></body></html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    }
  );

const createRedirectResponse = (
  request: Request,
  path: string,
  params: Readonly<Record<string, string>> = {}
): Response => {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return Response.redirect(url.toString(), 302);
};

const buildDoiDispatchPayload = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly subscriptionId: string;
  readonly email: string;
  readonly locationLabel: string;
  readonly confirmToken: string;
}): MailDispatchPayload => ({
  orderId: input.subscriptionId,
  transportId: input.config.transportId,
  messageKind: 'transactional',
  templateKey: 'waste.email-reminder.doi',
  locale: 'de-DE',
  addresses: [
    {
      kind: 'to',
      email: input.email,
    },
    ...(input.config.replyToEmail
      ? [
          {
            kind: 'reply_to' as const,
            email: input.config.replyToEmail,
          },
        ]
      : []),
  ],
  templatePayload: {
    confirmUrl: buildPublicUrl(input.config.publicBaseUrl, input.config.doiConfirmPath, {
      token: input.confirmToken,
    }),
    locationLabel: input.locationLabel,
    privacyPolicyUrl: input.config.privacyPolicyUrl,
    imprintUrl: input.config.imprintUrl,
    ...(input.config.serviceLabel ? { serviceLabel: input.config.serviceLabel } : {}),
    ...(input.config.dataControllerLabel
      ? { dataControllerLabel: input.config.dataControllerLabel }
      : {}),
  },
  tags: ['waste-management', 'email-reminder', 'double-opt-in'],
  metadata: {
    module: 'waste-management',
    flow: 'public-email-reminder-signup',
    subscriptionId: input.subscriptionId,
  },
});

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

const enforceReminderSignupRateLimits = (input: {
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

const buildPendingReminderSignup = (input: {
  readonly request: ReminderSignupInput;
  readonly email: string;
  readonly emailHash: string;
  readonly locationLabel: string;
  readonly now: Date;
  readonly subscriptionId: string;
  readonly confirmToken: string;
  readonly unsubscribeToken: string;
  readonly createId: () => string;
  readonly hashValue: (value: string) => string;
}): WasteEmailReminderPendingSignupInput => ({
  subscriptionId: input.subscriptionId,
  email: input.email,
  emailHash: input.emailHash,
  selection: input.request.payload.selection,
  locationLabel: input.locationLabel,
  consentVersion: input.request.reminderConfig.consentVersion,
  consentAcceptedAt: toIsoString(input.now),
  doiTokenHash: input.hashValue(input.confirmToken),
  unsubscribeTokenHash: input.hashValue(input.unsubscribeToken),
  expiresAt: toIsoString(
    addHours(input.now, input.request.reminderConfig.doiTokenTtlHours)
  ),
  items: input.request.payload.items.map((item) => ({
    id: input.createId(),
    fractionId: item.fractionId,
    slotId: item.slotId,
  })),
  outbox: {
    id: input.createId(),
    transportId: input.request.reminderConfig.transportId,
    templateKey: 'waste.email-reminder.doi',
    sendAt: toIsoString(input.now),
    dedupeKey: `doi:${input.subscriptionId}`,
    payload: buildDoiDispatchPayload({
      config: input.request.reminderConfig,
      subscriptionId: input.subscriptionId,
      email: input.email,
      locationLabel: input.locationLabel,
      confirmToken: input.confirmToken,
    }),
  },
});

const persistPendingReminderSignup = async (input: {
  readonly deps: ReminderSignupDependencies;
  readonly signup: WasteEmailReminderPendingSignupInput;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
}): Promise<void> => {
  if (input.deps.persistPendingSignupWithLimitCheck) {
    const result = await input.deps.persistPendingSignupWithLimitCheck({
      signup: input.signup,
      maxSubscriptionsPerEmailAndLocation:
        input.reminderConfig.maxSubscriptionsPerEmailAndLocation,
    });
    if (result === 'subscription_limit_reached') {
      throw new PublicWasteReminderSignupError({
        code: 'subscription_limit_reached',
        message: SUBSCRIPTION_LIMIT_REACHED_MESSAGE,
        status: 409,
      });
    }
    return;
  }
  if (input.deps.countExistingSubscriptions) {
    const existingCount = await input.deps.countExistingSubscriptions({
      emailHash: input.signup.emailHash,
      selection: input.signup.selection,
    });
    if (existingCount >= input.reminderConfig.maxSubscriptionsPerEmailAndLocation) {
      throw new PublicWasteReminderSignupError({
        code: 'subscription_limit_reached',
        message: SUBSCRIPTION_LIMIT_REACHED_MESSAGE,
        status: 409,
      });
    }
  }
  await input.deps.persistPendingSignup(input.signup);
};

export const createPublicWasteReminderSignupSubmitter =
  (deps: ReminderSignupDependencies) =>
  async (input: ReminderSignupInput): Promise<PublicWasteReminderSignupResponse> => {
    const email = normalizeEmail(input.payload.email);
    const hashValue = deps.hashValue ?? createSha256Hash;
    const emailHash = hashValue(email);
    const locationLabel = await input.repository.loadSelectionSummary({
      selection: input.payload.selection,
    });
    const now = deps.now?.() ?? new Date();
    const nowMs = now.getTime();
    const createId = deps.createId ?? randomUUID;
    const createToken = deps.createToken ?? createOpaqueToken;
    const subscriptionId = createId();
    const confirmToken = createToken();
    const unsubscribeToken = createToken();
    enforceReminderSignupRateLimits({
      consumeRateLimit: deps.consumeRateLimit,
      request: input.request,
      reminderConfig: input.reminderConfig,
      emailHash,
      now: nowMs,
    });
    const pendingSignup = buildPendingReminderSignup({
      request: input,
      email,
      emailHash,
      locationLabel,
      now,
      subscriptionId,
      confirmToken,
      unsubscribeToken,
      createId,
      hashValue,
    });
    await persistPendingReminderSignup({
      deps,
      signup: pendingSignup,
      reminderConfig: input.reminderConfig,
    });

    return {
      status: 'pending',
      headline: DEFAULT_PENDING_HEADLINE,
      message: DEFAULT_PENDING_MESSAGE,
    };
  };

export const createPublicWasteReminderSignupRateLimitConsumer = createReminderRateLimitConsumer;

const renderDoiSuccessPage = (config: WasteManagementEmailReminderConfig): Response =>
  buildStatusPageResponse({
    title: config.doiSuccessHeadline ?? 'E-Mail-Erinnerung aktiviert',
    headline: config.doiSuccessHeadline ?? 'E-Mail-Erinnerung aktiviert',
    body: config.doiSuccessBody ?? 'Ihre E-Mail-Erinnerung ist jetzt aktiv.',
  });

const renderDoiErrorPage = (
  config: WasteManagementEmailReminderConfig,
  result: 'expired' | 'invalid'
): Response =>
  buildStatusPageResponse({
    title: config.doiErrorHeadline ?? 'Link ungültig',
    headline: config.doiErrorHeadline ?? 'Link ungültig',
    body:
      result === 'expired' && config.doiExpiryNoticeText
        ? config.doiExpiryNoticeText
        : (config.doiErrorBody ?? 'Der Bestätigungslink ist ungültig oder abgelaufen.'),
  });

const renderUnsubscribeSuccessPage = (
  config: WasteManagementEmailReminderConfig,
  state: 'unsubscribed' | 'already_unsubscribed'
): Response =>
  buildStatusPageResponse({
    title:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneHeadline ?? config.unsubscribeSuccessHeadline)
        : config.unsubscribeSuccessHeadline,
    headline:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneHeadline ?? config.unsubscribeSuccessHeadline)
        : config.unsubscribeSuccessHeadline,
    body:
      state === 'already_unsubscribed'
        ? (config.unsubscribeAlreadyDoneBody ?? config.unsubscribeSuccessBody)
        : config.unsubscribeSuccessBody,
  });

const renderUnsubscribeErrorPage = (config: WasteManagementEmailReminderConfig): Response =>
  buildStatusPageResponse({
    title: config.unsubscribeErrorHeadline ?? 'Abmeldung fehlgeschlagen',
    headline: config.unsubscribeErrorHeadline ?? 'Abmeldung fehlgeschlagen',
    body: config.unsubscribeErrorBody ?? 'Der Abmeldelink ist ungültig oder nicht mehr verwendbar.',
  });

const renderConfiguredReminderStatusPage = (input: {
  readonly request: Request;
  readonly pathname: string;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
}): Response | null => {
  const { pathname, reminderConfig: config } = input;
  const url = new URL(input.request.url);

  if (config.activationSuccessPath && pathname === config.activationSuccessPath) {
    return renderDoiSuccessPage(config);
  }
  if (config.unsubscribeSuccessPath && pathname === config.unsubscribeSuccessPath) {
    const state =
      url.searchParams.get('state') === 'already_unsubscribed'
        ? 'already_unsubscribed'
        : 'unsubscribed';
    return renderUnsubscribeSuccessPage(config, state);
  }
  if (config.invalidTokenPath && pathname === config.invalidTokenPath) {
    return url.searchParams.get('source') === 'unsubscribe'
      ? renderUnsubscribeErrorPage(config)
      : renderDoiErrorPage(config, 'invalid');
  }
  return null;
};

const renderDoiActionError = (
  input: ReminderPageInput,
  result: 'expired' | 'invalid'
): Response =>
  input.reminderConfig.invalidTokenPath
    ? createRedirectResponse(input.request, input.reminderConfig.invalidTokenPath, {
        source: 'doi',
        reason: result,
      })
    : renderDoiErrorPage(input.reminderConfig, result);

const renderUnsubscribeActionError = (input: ReminderPageInput): Response =>
  input.reminderConfig.invalidTokenPath
    ? createRedirectResponse(input.request, input.reminderConfig.invalidTokenPath, {
        source: 'unsubscribe',
        reason: 'invalid',
      })
    : renderUnsubscribeErrorPage(input.reminderConfig);

const handleDoiReminderAction = async (input: {
  readonly deps: ReminderTokenActionDependencies;
  readonly page: ReminderPageInput;
  readonly token: string | undefined;
  readonly hashValue: (value: string) => string;
  readonly now: string;
}): Promise<Response> => {
  if (!input.token) {
    return renderDoiActionError(input.page, 'invalid');
  }
  const result = await input.deps.activateByDoiTokenHash({
    tokenHash: normalizeBearerTokenToHash(input.token, input.hashValue),
    now: input.now,
  });
  if (result.status === 'activated' || result.status === 'already_active') {
    return input.page.reminderConfig.activationSuccessPath
      ? createRedirectResponse(
          input.page.request,
          input.page.reminderConfig.activationSuccessPath,
          { state: result.status }
        )
      : renderDoiSuccessPage(input.page.reminderConfig);
  }
  return renderDoiActionError(input.page, result.status);
};

const handleUnsubscribeReminderAction = async (input: {
  readonly deps: ReminderTokenActionDependencies;
  readonly page: ReminderPageInput;
  readonly token: string | undefined;
  readonly now: string;
}): Promise<Response> => {
  if (!input.token) {
    return renderUnsubscribeActionError(input.page);
  }
  const subscriptionId = readWasteManagementUnsubscribeTokenSubscriptionId(input.token);
  if (!subscriptionId) {
    return renderUnsubscribeActionError(input.page);
  }
  const subscription = await input.deps.loadUnsubscribeSubscriptionById({ subscriptionId });
  if (
    !subscription ||
    !verifyWasteManagementUnsubscribeToken({
      token: input.token,
      subscriptionId,
      unsubscribeTokenHash: subscription.unsubscribeTokenHash,
      secret: input.page.unsubscribeTokenSecret,
    })
  ) {
    return renderUnsubscribeActionError(input.page);
  }
  const result = await input.deps.unsubscribeByTokenHash({
    tokenHash: subscription.unsubscribeTokenHash,
    now: input.now,
  });
  if (result.status === 'unsubscribed' || result.status === 'already_unsubscribed') {
    return input.page.reminderConfig.unsubscribeSuccessPath
      ? createRedirectResponse(
          input.page.request,
          input.page.reminderConfig.unsubscribeSuccessPath,
          { state: result.status }
        )
      : renderUnsubscribeSuccessPage(input.page.reminderConfig, result.status);
  }
  return renderUnsubscribeActionError(input.page);
};

export const createPublicWasteReminderPageHandler =
  (deps: ReminderTokenActionDependencies) =>
  async (input: ReminderPageInput): Promise<Response | null> => {
    const configuredStatusPage = renderConfiguredReminderStatusPage(input);
    if (configuredStatusPage) {
      return configuredStatusPage;
    }

    const url = new URL(input.request.url);
    const token = url.searchParams.get('token')?.trim();
    const hashValue = deps.hashValue ?? createSha256Hash;
    const now = toIsoString(deps.now?.() ?? new Date());

    if (input.pathname === input.reminderConfig.doiConfirmPath) {
      return await handleDoiReminderAction({
        deps,
        page: input,
        token,
        hashValue,
        now,
      });
    }

    if (input.pathname === input.reminderConfig.unsubscribePath) {
      return await handleUnsubscribeReminderAction({
        deps,
        page: input,
        token,
        now,
      });
    }

    return null;
  };
