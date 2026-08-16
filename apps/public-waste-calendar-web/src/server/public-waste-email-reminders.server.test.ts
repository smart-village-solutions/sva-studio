import { describe, expect, it, vi } from 'vitest';
import { createWasteManagementUnsubscribeToken } from '@sva/waste-management-contracts/unsubscribe-token';

import type { WasteManagementEmailReminderConfig } from '@sva/core';
import type {
  WasteEmailReminderActivationResult,
  WasteEmailReminderPendingSignupInput,
  WasteEmailReminderUnsubscribeResult,
  WasteEmailReminderUnsubscribeSubscription,
} from '@sva/data-repositories';
import {
  createPublicWasteReminderPageHandler as createReminderPageHandler,
  createPublicWasteReminderSignupRateLimitConsumer as createReminderSignupRateLimitConsumer,
  createPublicWasteReminderSignupSubmitter as createReminderSignupSubmitter,
} from './public-waste-email-reminders.server.js';

describe('public waste email reminders server helper', () => {
  it('builds and persists a pending DOI signup with normalized payload data and DOI expiry', async () => {
    const persisted: WasteEmailReminderPendingSignupInput[] = [];
    const submitter = createReminderSignupSubmitter({
      countExistingSubscriptions: vi.fn().mockResolvedValue(0),
      persistPendingSignup: async (input) => {
        persisted.push(input);
      },
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      createId: vi
        .fn()
        .mockReturnValueOnce('subscription-1')
        .mockReturnValueOnce('item-1')
        .mockReturnValueOnce('item-2')
        .mockReturnValueOnce('outbox-1'),
      createToken: vi
        .fn()
        .mockReturnValueOnce('confirm-token')
        .mockReturnValueOnce('unsubscribe-token'),
      hashValue: (value) => `sha256:${value}`,
    });

    const response = await submitter({
      request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
        method: 'POST',
      }),
      payload: {
        selection: {
          cityId: '22222222-2222-4222-8222-222222222222',
          streetId: '33333333-3333-4333-8333-333333333333',
        },
        email: ' Person@Example.Invalid ',
        items: [
          { fractionId: 'bio', slotId: 'bio:first' },
          { fractionId: 'paper', slotId: 'paper:second' },
        ],
        consentAccepted: true,
      },
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        replyToEmail: 'service@example.invalid',
        serviceLabel: 'Ihr Muelli',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v2',
        dataControllerLabel: 'Landkreis Beispiel',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie.',
        doiButtonLabel: 'Jetzt bestaetigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      repository: {
        loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
      },
    });

    expect(response).toEqual({
      status: 'pending',
      headline: 'Bestätigungslink versendet',
      message:
        'Bitte prüfen Sie Ihr E-Mail-Postfach und bestätigen Sie die Anmeldung über den enthaltenen Link.',
    });
    expect(persisted).toEqual([
      {
        subscriptionId: 'subscription-1',
        email: 'person@example.invalid',
        emailHash: 'sha256:person@example.invalid',
        selection: {
          cityId: '22222222-2222-4222-8222-222222222222',
          streetId: '33333333-3333-4333-8333-333333333333',
        },
        locationLabel: 'Perleberg, Ackerstr. 12',
        consentVersion: 'v2',
        consentAcceptedAt: '2026-06-14T20:00:00.000Z',
        doiTokenHash: 'sha256:confirm-token',
        unsubscribeTokenHash: 'sha256:unsubscribe-token',
        expiresAt: '2026-06-15T20:00:00.000Z',
        items: [
          { id: 'item-1', fractionId: 'bio', slotId: 'bio:first' },
          { id: 'item-2', fractionId: 'paper', slotId: 'paper:second' },
        ],
        outbox: {
          id: 'outbox-1',
          transportId: 'mail-1',
          templateKey: 'waste.email-reminder.doi',
          sendAt: '2026-06-14T20:00:00.000Z',
          dedupeKey: 'doi:subscription-1',
          payload: {
            orderId: 'subscription-1',
            transportId: 'mail-1',
            messageKind: 'transactional',
            templateKey: 'waste.email-reminder.doi',
            locale: 'de-DE',
            addresses: [
              { kind: 'to', email: 'person@example.invalid' },
              { kind: 'reply_to', email: 'service@example.invalid' },
            ],
            templatePayload: {
              confirmUrl: 'https://example.invalid/erinnerungen/bestaetigen?token=confirm-token',
              locationLabel: 'Perleberg, Ackerstr. 12',
              privacyPolicyUrl: 'https://example.invalid/datenschutz',
              imprintUrl: 'https://example.invalid/impressum',
              serviceLabel: 'Ihr Muelli',
              dataControllerLabel: 'Landkreis Beispiel',
            },
            tags: ['waste-management', 'email-reminder', 'double-opt-in'],
            metadata: {
              module: 'waste-management',
              flow: 'public-email-reminder-signup',
              subscriptionId: 'subscription-1',
            },
          },
        },
      },
    ]);
  });

  it('rejects signup attempts after the configured email rate limit is exceeded', async () => {
    const submitter = createReminderSignupSubmitter({
      countExistingSubscriptions: vi.fn().mockResolvedValue(0),
      consumeRateLimit: createReminderSignupRateLimitConsumer(),
      persistPendingSignup: vi.fn(),
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    const baseInput = {
      request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.10',
        },
      }),
      payload: {
        selection: {
          cityId: '22222222-2222-4222-8222-222222222222',
          streetId: '33333333-3333-4333-8333-333333333333',
        },
        email: 'person@example.invalid',
        items: [{ fractionId: 'bio', slotId: 'bio:first' }],
        consentAccepted: true,
      },
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v2',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie.',
        doiButtonLabel: 'Jetzt bestaetigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 1,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      repository: {
        loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
      },
    } as const;

    await submitter(baseInput);
    await expect(submitter(baseInput)).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it('rejects signup attempts when the location subscription limit is already reached', async () => {
    const submitter = createReminderSignupSubmitter({
      countExistingSubscriptions: vi.fn().mockResolvedValue(3),
      persistPendingSignup: vi.fn(),
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    await expect(
      submitter({
        request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
          method: 'POST',
        }),
        payload: {
          selection: {
            cityId: '22222222-2222-4222-8222-222222222222',
            streetId: '33333333-3333-4333-8333-333333333333',
          },
          email: 'person@example.invalid',
          items: [{ fractionId: 'bio', slotId: 'bio:first' }],
          consentAccepted: true,
        },
        reminderConfig: {
          enabled: true,
          publicSignupEnabled: true,
          transportId: 'mail-1',
          publicBaseUrl: 'https://example.invalid',
          doiConfirmPath: '/erinnerungen/bestaetigen',
          unsubscribePath: '/erinnerungen/abmelden',
          fromName: 'Abfallwirtschaft',
          fromEmail: 'abfall@example.invalid',
          privacyPolicyUrl: 'https://example.invalid/datenschutz',
          imprintUrl: 'https://example.invalid/impressum',
          consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
          consentVersion: 'v2',
          doiSubjectTemplate: 'Bitte bestaetigen',
          doiIntroText: 'Bitte bestaetigen Sie.',
          doiButtonLabel: 'Jetzt bestaetigen',
          reminderSubjectTemplate: 'Erinnerung',
          reminderIntroTemplate: 'Nicht vergessen.',
          unsubscribeLinkLabel: 'Abmelden',
          unsubscribeSuccessHeadline: 'Abgemeldet',
          unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
          maxSubscriptionsPerEmailAndLocation: 3,
          signupRateLimitPerIpPerHour: 10,
          signupRateLimitPerEmailPerHour: 3,
          doiTokenTtlHours: 24,
          pendingSubscriptionTtlHours: 48,
          materializationLookaheadDays: 7,
        },
        repository: {
          loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
        },
      })
    ).rejects.toMatchObject({
      code: 'subscription_limit_reached',
      status: 409,
    });
  });

  it('renders a DOI success page for a valid confirmation token', async () => {
    const handler = createReminderPageHandler({
      activateByDoiTokenHash: vi.fn().mockResolvedValue({
        status: 'activated',
        subscriptionId: 'subscription-1',
        locationLabel: 'Perleberg, Ackerstr. 12',
      }),
      loadUnsubscribeSubscriptionById: vi.fn(),
      unsubscribeByTokenHash: vi.fn(),
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    const response = await handler({
      request: new Request('https://example.invalid/erinnerungen/bestaetigen?token=confirm-token'),
      pathname: '/erinnerungen/bestaetigen',
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v2',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie.',
        doiButtonLabel: 'Jetzt bestaetigen',
        doiSuccessHeadline: 'Aktiviert',
        doiSuccessBody: 'Ihre Erinnerung ist nun aktiv.',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      unsubscribeTokenSecret: 'postgres://waste:test@localhost:5432/waste',
    });

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain('Aktiviert');
  });

  it('redirects invalid unsubscribe tokens to the configured invalid-token page', async () => {
    const handler = createReminderPageHandler({
      activateByDoiTokenHash: vi.fn(),
      unsubscribeByTokenHash: vi.fn().mockResolvedValue({
        status: 'invalid',
      }),
      loadUnsubscribeSubscriptionById: vi.fn(),
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    const response = await handler({
      request: new Request('https://example.invalid/erinnerungen/abmelden?token=unsubscribe-token'),
      pathname: '/erinnerungen/abmelden',
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        invalidTokenPath: '/erinnerungen/ungueltig',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v2',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie.',
        doiButtonLabel: 'Jetzt bestaetigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      unsubscribeTokenSecret: 'postgres://waste:test@localhost:5432/waste',
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      'https://example.invalid/erinnerungen/ungueltig?source=unsubscribe&reason=invalid'
    );
  });

  it('accepts signed unsubscribe tokens for reminder links and resolves them back to the stored hash', async () => {
    const unsubscribeByTokenHash = vi.fn().mockResolvedValue({
      status: 'already_unsubscribed',
      subscriptionId: 'subscription-1',
      locationLabel: 'Perleberg, Ackerstr. 12',
    });
    const loadUnsubscribeSubscriptionById = vi.fn().mockResolvedValue({
      subscriptionId: 'subscription-1',
      unsubscribeTokenHash: 'sha256:unsubscribe-token',
    });
    const handler = createReminderPageHandler({
      activateByDoiTokenHash: vi.fn(),
      loadUnsubscribeSubscriptionById,
      unsubscribeByTokenHash,
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });
    const token = createWasteManagementUnsubscribeToken({
      subscriptionId: 'subscription-1',
      unsubscribeTokenHash: 'sha256:unsubscribe-token',
      secret: 'postgres://waste:test@localhost:5432/waste',
    });

    const response = await handler({
      request: new Request(`https://example.invalid/erinnerungen/abmelden?token=${token}`),
      pathname: '/erinnerungen/abmelden',
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v2',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie.',
        doiButtonLabel: 'Jetzt bestaetigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      unsubscribeTokenSecret: 'postgres://waste:test@localhost:5432/waste',
    });

    expect(loadUnsubscribeSubscriptionById).toHaveBeenCalledWith({
      subscriptionId: 'subscription-1',
    });
    expect(unsubscribeByTokenHash).toHaveBeenCalledWith({
      tokenHash: 'sha256:unsubscribe-token',
      now: '2026-06-14T20:00:00.000Z',
    });
    expect(response?.status).toBe(200);
  });
});

const fixedActionNow = new Date('2026-06-14T20:00:00.000Z');
const testUnsubscribeSecret = 'public-waste-reminder-test-secret';
const storedUnsubscribeTokenHash = 'sha256:stored-unsubscribe-token';

const reminderActionConfig = {
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'mail-1',
  publicBaseUrl: 'https://example.invalid',
  doiConfirmPath: '/erinnerungen/bestaetigen',
  activationSuccessPath: '/erinnerungen/aktiviert',
  unsubscribePath: '/erinnerungen/abmelden',
  unsubscribeSuccessPath: '/erinnerungen/abgemeldet',
  invalidTokenPath: '/erinnerungen/ungueltig',
  fromName: 'Abfallwirtschaft',
  fromEmail: 'abfall@example.invalid',
  privacyPolicyUrl: 'https://example.invalid/datenschutz',
  imprintUrl: 'https://example.invalid/impressum',
  consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
  consentVersion: 'v2',
  doiSubjectTemplate: 'Bitte bestaetigen',
  doiIntroText: 'Bitte bestaetigen Sie.',
  doiButtonLabel: 'Jetzt bestaetigen',
  doiSuccessHeadline: 'Aktiviert',
  doiSuccessBody: 'Ihre Erinnerung ist nun aktiv.',
  doiErrorHeadline: 'Bestaetigung fehlgeschlagen',
  doiErrorBody: 'Der Bestaetigungslink ist ungueltig.',
  doiExpiryNoticeText: 'Der Bestaetigungslink ist abgelaufen.',
  reminderSubjectTemplate: 'Erinnerung',
  reminderIntroTemplate: 'Nicht vergessen.',
  unsubscribeLinkLabel: 'Abmelden',
  unsubscribeSuccessHeadline: 'Abgemeldet',
  unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
  unsubscribeAlreadyDoneHeadline: 'Bereits abgemeldet',
  unsubscribeAlreadyDoneBody: 'Die Erinnerung war bereits abgemeldet.',
  unsubscribeErrorHeadline: 'Abmeldung fehlgeschlagen',
  unsubscribeErrorBody: 'Der Abmeldelink ist ungueltig.',
  maxSubscriptionsPerEmailAndLocation: 3,
  signupRateLimitPerIpPerHour: 10,
  signupRateLimitPerEmailPerHour: 3,
  doiTokenTtlHours: 24,
  pendingSubscriptionTtlHours: 48,
  materializationLookaheadDays: 7,
} satisfies WasteManagementEmailReminderConfig;

const reminderActionFallbackConfig = {
  ...reminderActionConfig,
  activationSuccessPath: '',
  unsubscribeSuccessPath: '',
  invalidTokenPath: '',
} satisfies WasteManagementEmailReminderConfig;

type ReminderActionHarnessOptions = Readonly<{
  activationResult?: WasteEmailReminderActivationResult;
  subscription?: WasteEmailReminderUnsubscribeSubscription | null;
  unsubscribeResult?: WasteEmailReminderUnsubscribeResult;
}>;

const createReminderActionHarness = (options: ReminderActionHarnessOptions = {}) => {
  const calls: string[] = [];
  const now = vi.fn(() => {
    calls.push('now');
    return fixedActionNow;
  });
  const hashValue = vi.fn((value: string) => {
    calls.push('hash');
    return `sha256:${value}`;
  });
  const activateByDoiTokenHash = vi.fn(async () => {
    calls.push('activate');
    return options.activationResult ?? ({ status: 'invalid' } as const);
  });
  const loadUnsubscribeSubscriptionById = vi.fn(async () => {
    calls.push('load');
    return options.subscription === undefined
      ? {
          subscriptionId: 'subscription-1',
          unsubscribeTokenHash: storedUnsubscribeTokenHash,
        }
      : options.subscription;
  });
  const unsubscribeByTokenHash = vi.fn(async () => {
    calls.push('unsubscribe');
    return options.unsubscribeResult ?? ({ status: 'invalid' } as const);
  });
  const handler = createReminderPageHandler({
    activateByDoiTokenHash,
    loadUnsubscribeSubscriptionById,
    unsubscribeByTokenHash,
    now,
    hashValue,
  });

  return {
    activateByDoiTokenHash,
    calls,
    handler,
    hashValue,
    loadUnsubscribeSubscriptionById,
    now,
    unsubscribeByTokenHash,
  };
};

const invokeReminderAction = async (input: {
  readonly handler: ReturnType<typeof createReminderPageHandler>;
  readonly pathname: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly reminderConfig?: WasteManagementEmailReminderConfig;
}): Promise<Response | null> => {
  const url = new URL(input.pathname, 'https://example.invalid');
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value);
  }
  return await input.handler({
    request: new Request(url),
    pathname: input.pathname,
    reminderConfig: input.reminderConfig ?? reminderActionConfig,
    unsubscribeTokenSecret: testUnsubscribeSecret,
  });
};

const createSignedUnsubscribeToken = (
  unsubscribeTokenHash: string = storedUnsubscribeTokenHash
): string =>
  createWasteManagementUnsubscribeToken({
    subscriptionId: 'subscription-1',
    unsubscribeTokenHash,
    secret: testUnsubscribeSecret,
  });

describe('public waste reminder action characterization', () => {
  it.each([
    {
      label: 'DOI activation success',
      pathname: reminderActionConfig.activationSuccessPath,
      query: {},
      expectedText: 'Aktiviert',
    },
    {
      label: 'unsubscribe success',
      pathname: reminderActionConfig.unsubscribeSuccessPath,
      query: { state: 'unsubscribed' },
      expectedText: 'Abgemeldet',
    },
    {
      label: 'already unsubscribed',
      pathname: reminderActionConfig.unsubscribeSuccessPath,
      query: { state: 'already_unsubscribed' },
      expectedText: 'Bereits abgemeldet',
    },
    {
      label: 'DOI invalid token',
      pathname: reminderActionConfig.invalidTokenPath,
      query: { source: 'doi' },
      expectedText: 'Bestaetigung fehlgeschlagen',
    },
    {
      label: 'unsubscribe invalid token',
      pathname: reminderActionConfig.invalidTokenPath,
      query: { source: 'unsubscribe' },
      expectedText: 'Abmeldung fehlgeschlagen',
    },
  ] satisfies readonly Readonly<{
    label: string;
    pathname: string;
    query: Readonly<Record<string, string>>;
    expectedText: string;
  }>[])('renders the configured $label page before token dependencies', async (testCase) => {
    const harness = createReminderActionHarness();

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: testCase.pathname,
      query: testCase.query as Readonly<Record<string, string>>,
    });

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain(testCase.expectedText);
    expect(harness.calls).toEqual([]);
  });

  it('rejects a missing DOI token before hashing or activation', async () => {
    const harness = createReminderActionHarness();

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.doiConfirmPath,
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      'https://example.invalid/erinnerungen/ungueltig?source=doi&reason=invalid'
    );
    expect(harness.calls).toEqual(['now']);
    expect(harness.activateByDoiTokenHash).not.toHaveBeenCalled();
    expect(harness.hashValue).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'activated' as const, path: 'aktiviert', state: 'activated' },
    { status: 'already_active' as const, path: 'aktiviert', state: 'already_active' },
    { status: 'expired' as const, path: 'ungueltig', state: 'expired' },
    { status: 'invalid' as const, path: 'ungueltig', state: 'invalid' },
  ])('preserves DOI $status redirects, fixed time, hashing, and call order', async (testCase) => {
    const activationResult: WasteEmailReminderActivationResult =
      testCase.status === 'activated' || testCase.status === 'already_active'
        ? {
            status: testCase.status,
            subscriptionId: 'subscription-1',
            locationLabel: 'Perleberg, Ackerstr. 12',
          }
        : { status: testCase.status };
    const harness = createReminderActionHarness({ activationResult });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.doiConfirmPath,
      query: { token: 'doi-token' },
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      testCase.path === 'aktiviert'
        ? `https://example.invalid/erinnerungen/aktiviert?state=${testCase.state}`
        : `https://example.invalid/erinnerungen/ungueltig?source=doi&reason=${testCase.state}`
    );
    expect(harness.calls).toEqual(['now', 'hash', 'activate']);
    expect(harness.hashValue).toHaveBeenCalledOnce();
    expect(harness.activateByDoiTokenHash).toHaveBeenCalledWith({
      tokenHash: 'sha256:doi-token',
      now: fixedActionNow.toISOString(),
    });
  });

  it.each([
    { status: 'activated' as const, expectedText: 'Aktiviert' },
    { status: 'expired' as const, expectedText: 'Der Bestaetigungslink ist abgelaufen.' },
  ])('renders the DOI $status fallback response without configured redirects', async (testCase) => {
    const activationResult: WasteEmailReminderActivationResult =
      testCase.status === 'activated'
        ? {
            status: 'activated',
            subscriptionId: 'subscription-1',
            locationLabel: 'Perleberg, Ackerstr. 12',
          }
        : { status: 'expired' };
    const harness = createReminderActionHarness({ activationResult });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionFallbackConfig.doiConfirmPath,
      query: { token: 'doi-token' },
      reminderConfig: reminderActionFallbackConfig,
    });

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain(testCase.expectedText);
  });

  it.each([
    { label: 'missing token', token: undefined, expectedCalls: ['now'] },
    { label: 'unreadable subscription id', token: 'unreadable', expectedCalls: ['now'] },
  ])('rejects an unsubscribe $label before lookup or mutation', async (testCase) => {
    const harness = createReminderActionHarness();

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.unsubscribePath,
      query: testCase.token ? { token: testCase.token } : {},
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      'https://example.invalid/erinnerungen/ungueltig?source=unsubscribe&reason=invalid'
    );
    expect(harness.calls).toEqual(testCase.expectedCalls);
    expect(harness.loadUnsubscribeSubscriptionById).not.toHaveBeenCalled();
    expect(harness.unsubscribeByTokenHash).not.toHaveBeenCalled();
  });

  it('rejects a missing unsubscribe subscription without mutation', async () => {
    const harness = createReminderActionHarness({ subscription: null });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.unsubscribePath,
      query: { token: createSignedUnsubscribeToken() },
    });

    expect(response?.status).toBe(302);
    expect(harness.calls).toEqual(['now', 'load']);
    expect(harness.loadUnsubscribeSubscriptionById).toHaveBeenCalledWith({
      subscriptionId: 'subscription-1',
    });
    expect(harness.unsubscribeByTokenHash).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'signature mismatch',
      token: `${createSignedUnsubscribeToken()}-changed`,
      subscriptionHash: storedUnsubscribeTokenHash,
    },
    {
      label: 'foreign subscription hash',
      token: createSignedUnsubscribeToken('sha256:other-subscription-token'),
      subscriptionHash: storedUnsubscribeTokenHash,
    },
  ])('rejects an unsubscribe $label after lookup and before mutation', async (testCase) => {
    const harness = createReminderActionHarness({
      subscription: {
        subscriptionId: 'subscription-1',
        unsubscribeTokenHash: testCase.subscriptionHash,
      },
    });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.unsubscribePath,
      query: { token: testCase.token },
    });

    expect(response?.status).toBe(302);
    expect(harness.calls).toEqual(['now', 'load']);
    expect(harness.loadUnsubscribeSubscriptionById).toHaveBeenCalledOnce();
    expect(harness.unsubscribeByTokenHash).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'unsubscribed' as const, path: 'abgemeldet', state: 'unsubscribed' },
    {
      status: 'already_unsubscribed' as const,
      path: 'abgemeldet',
      state: 'already_unsubscribed',
    },
    { status: 'invalid' as const, path: 'ungueltig', state: 'invalid' },
  ])('preserves unsubscribe $status redirects, fixed time, and mutation order', async (testCase) => {
    const unsubscribeResult: WasteEmailReminderUnsubscribeResult =
      testCase.status === 'invalid'
        ? { status: 'invalid' }
        : {
            status: testCase.status,
            subscriptionId: 'subscription-1',
            locationLabel: 'Perleberg, Ackerstr. 12',
          };
    const harness = createReminderActionHarness({ unsubscribeResult });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionConfig.unsubscribePath,
      query: { token: createSignedUnsubscribeToken() },
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      testCase.path === 'abgemeldet'
        ? `https://example.invalid/erinnerungen/abgemeldet?state=${testCase.state}`
        : 'https://example.invalid/erinnerungen/ungueltig?source=unsubscribe&reason=invalid'
    );
    expect(harness.calls).toEqual(['now', 'load', 'unsubscribe']);
    expect(harness.loadUnsubscribeSubscriptionById).toHaveBeenCalledOnce();
    expect(harness.unsubscribeByTokenHash).toHaveBeenCalledOnce();
    expect(harness.unsubscribeByTokenHash).toHaveBeenCalledWith({
      tokenHash: storedUnsubscribeTokenHash,
      now: fixedActionNow.toISOString(),
    });
  });

  it.each([
    { status: 'already_unsubscribed' as const, expectedText: 'Bereits abgemeldet' },
    { status: 'invalid' as const, expectedText: 'Abmeldung fehlgeschlagen' },
  ])('renders the unsubscribe $status fallback response without configured redirects', async (testCase) => {
    const unsubscribeResult: WasteEmailReminderUnsubscribeResult =
      testCase.status === 'invalid'
        ? { status: 'invalid' }
        : {
            status: 'already_unsubscribed',
            subscriptionId: 'subscription-1',
            locationLabel: 'Perleberg, Ackerstr. 12',
          };
    const harness = createReminderActionHarness({ unsubscribeResult });

    const response = await invokeReminderAction({
      handler: harness.handler,
      pathname: reminderActionFallbackConfig.unsubscribePath,
      query: { token: createSignedUnsubscribeToken() },
      reminderConfig: reminderActionFallbackConfig,
    });

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain(testCase.expectedText);
  });

  it('returns null for unrelated paths after resolving the fixed time only', async () => {
    const harness = createReminderActionHarness();

    await expect(
      invokeReminderAction({ handler: harness.handler, pathname: '/unrelated' })
    ).resolves.toBeNull();
    expect(harness.calls).toEqual(['now']);
  });
});

const createSignupCharacterizationInput = () => ({
  request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
  }),
  payload: {
    selection: {
      cityId: '22222222-2222-4222-8222-222222222222',
      streetId: '33333333-3333-4333-8333-333333333333',
    },
    email: 'person@example.invalid',
    items: [{ fractionId: 'bio', slotId: 'bio:first' }],
    consentAccepted: true,
  },
  reminderConfig: reminderActionConfig,
  repository: {
    loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
  },
});

describe('public waste reminder signup orchestration characterization', () => {
  it('stops at the IP rate limit before consuming the email limit or persisting', async () => {
    const consumeRateLimit = vi
      .fn()
      .mockReturnValueOnce({ retryAfterSeconds: 60 })
      .mockReturnValueOnce(null);
    const persistPendingSignup = vi.fn();
    const submitter = createReminderSignupSubmitter({
      persistPendingSignup,
      consumeRateLimit,
      now: () => fixedActionNow,
      createId: vi.fn().mockReturnValue('generated-id'),
      createToken: vi.fn().mockReturnValue('generated-token'),
      hashValue: (value) => `sha256:${value}`,
    });

    await expect(submitter(createSignupCharacterizationInput())).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 60,
      status: 429,
    });
    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(consumeRateLimit).toHaveBeenCalledWith({
      key: 'ip:203.0.113.10',
      limit: reminderActionConfig.signupRateLimitPerIpPerHour,
      windowMs: 3_600_000,
      now: fixedActionNow.getTime(),
    });
    expect(persistPendingSignup).not.toHaveBeenCalled();
  });

  it('uses successful atomic limit-checked persistence without count or fallback persistence', async () => {
    const persistPendingSignup = vi.fn();
    const persistPendingSignupWithLimitCheck = vi.fn().mockResolvedValue('created');
    const countExistingSubscriptions = vi.fn();
    const submitter = createReminderSignupSubmitter({
      persistPendingSignup,
      persistPendingSignupWithLimitCheck,
      countExistingSubscriptions,
      now: () => fixedActionNow,
      createId: vi.fn().mockReturnValue('generated-id'),
      createToken: vi.fn().mockReturnValue('generated-token'),
      hashValue: (value) => `sha256:${value}`,
    });

    await expect(submitter(createSignupCharacterizationInput())).resolves.toMatchObject({
      status: 'pending',
    });
    expect(persistPendingSignupWithLimitCheck).toHaveBeenCalledOnce();
    expect(countExistingSubscriptions).not.toHaveBeenCalled();
    expect(persistPendingSignup).not.toHaveBeenCalled();
  });

  it('preserves the atomic subscription-limit error without fallback persistence', async () => {
    const persistPendingSignup = vi.fn();
    const persistPendingSignupWithLimitCheck = vi
      .fn()
      .mockResolvedValue('subscription_limit_reached');
    const submitter = createReminderSignupSubmitter({
      persistPendingSignup,
      persistPendingSignupWithLimitCheck,
      now: () => fixedActionNow,
      createId: vi.fn().mockReturnValue('generated-id'),
      createToken: vi.fn().mockReturnValue('generated-token'),
      hashValue: (value) => `sha256:${value}`,
    });

    await expect(submitter(createSignupCharacterizationInput())).rejects.toMatchObject({
      code: 'subscription_limit_reached',
      status: 409,
    });
    expect(persistPendingSignupWithLimitCheck).toHaveBeenCalledOnce();
    expect(persistPendingSignup).not.toHaveBeenCalled();
  });
});
