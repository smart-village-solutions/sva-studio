import { describe, expect, it, vi } from 'vitest';

import type { WasteEmailReminderPendingSignupInput } from '@sva/data-repositories';
import {
  createPublicWasteReminderPageHandler,
  createPublicWasteReminderSignupRateLimitConsumer,
  createPublicWasteReminderSignupSubmitter,
  PublicWasteReminderSignupError,
} from './public-waste-email-reminders.server.js';

describe('public waste email reminders server helper', () => {
  it('builds and persists a pending DOI signup with normalized payload data', async () => {
    const persisted: WasteEmailReminderPendingSignupInput[] = [];
    const submitter = createPublicWasteReminderSignupSubmitter({
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
      createToken: vi.fn().mockReturnValueOnce('confirm-token').mockReturnValueOnce('unsubscribe-token'),
      hashValue: (value) => `sha256:${value}`,
    });

    const response = await submitter({
      request: new Request('https://example.invalid/api/public-waste/reminder-signups', { method: 'POST' }),
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
      message: 'Bitte prüfen Sie Ihr E-Mail-Postfach und bestätigen Sie die Anmeldung über den enthaltenen Link.',
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
        expiresAt: '2026-06-16T20:00:00.000Z',
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
    const submitter = createPublicWasteReminderSignupSubmitter({
      countExistingSubscriptions: vi.fn().mockResolvedValue(0),
      consumeRateLimit: createPublicWasteReminderSignupRateLimitConsumer(),
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
    const submitter = createPublicWasteReminderSignupSubmitter({
      countExistingSubscriptions: vi.fn().mockResolvedValue(3),
      persistPendingSignup: vi.fn(),
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    await expect(
      submitter({
        request: new Request('https://example.invalid/api/public-waste/reminder-signups', { method: 'POST' }),
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
    const handler = createPublicWasteReminderPageHandler({
      activateByDoiTokenHash: vi.fn().mockResolvedValue({
        status: 'activated',
        subscriptionId: 'subscription-1',
        locationLabel: 'Perleberg, Ackerstr. 12',
      }),
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
    });

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain('Aktiviert');
  });

  it('redirects invalid unsubscribe tokens to the configured invalid-token page', async () => {
    const handler = createPublicWasteReminderPageHandler({
      activateByDoiTokenHash: vi.fn(),
      unsubscribeByTokenHash: vi.fn().mockResolvedValue({
        status: 'invalid',
      }),
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
    });

    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      'https://example.invalid/erinnerungen/ungueltig?source=unsubscribe&reason=invalid'
    );
  });

  it('accepts stored unsubscribe token hashes as opaque bearer tokens for reminder links', async () => {
    const unsubscribeByTokenHash = vi.fn().mockResolvedValue({
      status: 'already_unsubscribed',
      subscriptionId: 'subscription-1',
      locationLabel: 'Perleberg, Ackerstr. 12',
    });
    const handler = createPublicWasteReminderPageHandler({
      activateByDoiTokenHash: vi.fn(),
      unsubscribeByTokenHash,
      now: () => new Date('2026-06-14T20:00:00.000Z'),
      hashValue: (value) => `sha256:${value}`,
    });

    const response = await handler({
      request: new Request('https://example.invalid/erinnerungen/abmelden?token=sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
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
    });

    expect(unsubscribeByTokenHash).toHaveBeenCalledWith({
      tokenHash: 'sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      now: '2026-06-14T20:00:00.000Z',
    });
    expect(response?.status).toBe(200);
  });
});
