import { describe, expect, it } from 'vitest';

import type {
  MailDispatchPayload,
  MailTransportConfig,
  WasteCollectionLocationRecord,
  WasteManagementEmailReminderConfig,
} from '@sva/core';

import {
  addDaysUtc,
  buildDispatchMessage,
  buildReminderDispatchPayload,
  createUtcIsoAtHour,
  matchSelectionLocations,
  parseIsoDateUtc,
} from './waste-management-email-reminder-dispatch.server';

const createReminderConfig = (
  overrides: Partial<WasteManagementEmailReminderConfig> = {},
): WasteManagementEmailReminderConfig => ({
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'transport-smtp',
  publicBaseUrl: 'https://demo.abfallkalender.example',
  doiConfirmPath: '/erinnerungen/bestaetigen',
  unsubscribePath: '/erinnerungen/abmelden',
  signupSuccessPath: '/erinnerungen/pending',
  activationSuccessPath: '/erinnerungen/aktiviert',
  unsubscribeSuccessPath: '/erinnerungen/abgemeldet',
  invalidTokenPath: '/erinnerungen/ungueltig',
  fromName: 'Ihr Muelli',
  fromEmail: 'noreply@abfallkalender.example',
  replyToEmail: 'abfall@example.org',
  serviceLabel: 'Landkreis Prignitz',
  privacyPolicyUrl: 'https://demo.abfallkalender.example/datenschutz',
  imprintUrl: 'https://demo.abfallkalender.example/impressum',
  consentLabel: 'Ich stimme der Verarbeitung zu.',
  consentVersion: '2026-06',
  dataControllerLabel: 'Landkreis Prignitz',
  dataProtectionContactEmail: 'datenschutz@example.org',
  doiSubjectTemplate: 'Bitte Anmeldung fuer {{locationLabel}} bestaetigen',
  doiPreheader: 'Bitte bestaetigen.',
  doiIntroText: 'Bitte bestaetigen Sie Ihre Anmeldung fuer {{locationLabel}}.',
  doiButtonLabel: 'Jetzt bestaetigen',
  doiFallbackText: 'Fallback fuer {{confirmUrl}}',
  doiExpiryNoticeText: 'Ablaufhinweis',
  reminderSubjectTemplate: 'Abfalltermine fuer {{locationLabel}}',
  reminderIntroTemplate: 'Nicht vergessen: {{pickupDate}}',
  reminderListIntroTemplate: 'Folgende Fraktionen stehen an:',
  reminderOutroText: 'Mit freundlichen Gruessen',
  unsubscribeLinkLabel: 'E-Mail-Erinnerung abbestellen',
  reminderReasonText: 'Sie erhalten diese Nachricht.',
  unsubscribeSuccessHeadline: 'E-Mail-Erinnerung deaktiviert',
  unsubscribeSuccessBody: 'Der Dienst wurde deaktiviert.',
  unsubscribeAlreadyDoneHeadline: 'Bereits deaktiviert',
  unsubscribeAlreadyDoneBody: 'Die Erinnerung war bereits deaktiviert.',
  unsubscribeErrorHeadline: 'Abmeldung fehlgeschlagen',
  unsubscribeErrorBody: 'Der Link ist ungueltig.',
  maxSubscriptionsPerEmailAndLocation: 5,
  signupRateLimitPerIpPerHour: 10,
  signupRateLimitPerEmailPerHour: 5,
  doiTokenTtlHours: 48,
  pendingSubscriptionTtlHours: 72,
  materializationLookaheadDays: 7,
  unsubscribeTokenTtlDays: 365,
  ...overrides,
});

const createTransport = (
  overrides: Partial<Extract<MailTransportConfig, { transportType: 'smtp' }>> = {},
): Extract<MailTransportConfig, { transportType: 'smtp' }> => ({
  transportId: 'transport-smtp',
  displayName: 'SMTP',
  transportType: 'smtp',
  securityMode: 'starttls',
  authMode: 'basic',
  enabled: true,
  host: 'mail.example.org',
  port: 587,
  username: 'mailer',
  password: 'smtp-password',
  defaultFromEmail: 'transport@example.org',
  defaultFromName: 'Transport Default',
  defaultReplyToEmail: 'transport-reply@example.org',
  health: { visibleStatus: 'ok' },
  ...overrides,
});

const createReminderPayload = (
  overrides: Partial<MailDispatchPayload> = {},
): MailDispatchPayload => ({
  orderId: 'subscription-1',
  transportId: 'transport-smtp',
  messageKind: 'transactional',
  templateKey: 'waste.email-reminder.reminder',
  locale: 'de-DE',
  addresses: [
    { kind: 'to', email: 'max@example.org' },
    { kind: 'cc', email: 'copy@example.org' },
    { kind: 'bcc', email: 'blind@example.org' },
  ],
  templatePayload: {
    subject: 'Abfalltermine',
    introText: 'Nicht vergessen',
    listIntroText: 'Liste',
    outroText: 'Gruss',
    reasonText: 'Grund',
    unsubscribeLabel: 'Abmelden',
    unsubscribeUrl: 'https://example.org/unsubscribe',
    locationLabel: 'Perleberg',
    pickupDate: 'Di., 16.06.',
    fractionName: 'Papier',
    privacyPolicyUrl: 'https://example.org/privacy',
    imprintUrl: 'https://example.org/imprint',
    serviceLabel: 'Service Label',
  },
  tags: [],
  metadata: {},
  ...overrides,
});

describe('waste email reminder dispatch helpers', () => {
  it('builds UTC dates and rejects invalid pickup dates', () => {
    expect(createUtcIsoAtHour(new Date('2026-06-15T12:30:00.000Z'), 6)).toBe(
      '2026-06-15T06:00:00.000Z',
    );
    expect(addDaysUtc(new Date('2026-06-15T00:00:00.000Z'), 2).toISOString()).toBe(
      '2026-06-17T00:00:00.000Z',
    );
    expect(parseIsoDateUtc('2026-06-16').toISOString()).toBe('2026-06-16T00:00:00.000Z');
    expect(() => parseIsoDateUtc('invalid-date')).toThrowError('invalid_iso_date:invalid-date');
  });

  it('matches selection locations across region, street and house number variants', () => {
    const locations: WasteCollectionLocationRecord[] = [
      {
        id: 'legacy-region-match',
        regionId: undefined,
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: undefined,
        active: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'different-region',
        regionId: 'region-2',
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: undefined,
        active: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'all-street-match',
        regionId: undefined,
        cityId: 'city-1',
        streetId: undefined,
        houseNumberId: undefined,
        active: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'specific-house-match',
        regionId: undefined,
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        active: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'inactive',
        regionId: undefined,
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: undefined,
        active: false,
        createdAt: '',
        updatedAt: '',
      },
    ];

    expect(
      matchSelectionLocations(locations, {
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: 'street-1',
      }).map((location) => location.id),
    ).toEqual(['legacy-region-match', 'all-street-match']);

    expect(
      matchSelectionLocations(locations, {
        cityId: 'city-1',
        streetId: 'all',
      }).map((location) => location.id),
    ).toEqual(['all-street-match']);

    expect(
      matchSelectionLocations(locations, {
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
      }).map((location) => location.id),
    ).toEqual(['legacy-region-match', 'all-street-match', 'specific-house-match']);
  });

  it('builds reminder payloads without optional reply-to and service labels', () => {
    const payload = buildReminderDispatchPayload({
      config: createReminderConfig({
        replyToEmail: undefined,
        serviceLabel: undefined,
      }),
      subscriptionId: 'subscription-1',
      email: 'max@example.org',
      locationLabel: 'Perleberg',
      fraction: {
        id: 'fraction-paper',
        name: 'Papier',
        pdfShortLabel: 'PAP',
        translations: { de: 'Papier' },
        containerSize: undefined,
        color: '#0000ff',
        description: undefined,
        active: true,
        reminderConfig: {
          reminderCount: 'once',
          channels: { push: false, email: true, calendar: false },
          email: { slots: [{ id: 'paper:first', defaultLeadDays: 1, maxLeadDays: 3 }] },
        },
        createdAt: '',
        updatedAt: '',
      },
      pickupDate: '2026-06-16',
      unsubscribeTokenHash: 'sha256:unsubscribe',
      unsubscribeTokenSecret: 'secret',
    });

    expect(payload.addresses).toEqual([{ kind: 'to', email: 'max@example.org' }]);
    expect(payload.templatePayload).not.toHaveProperty('serviceLabel');
    expect(payload.templatePayload.unsubscribeUrl).toContain(
      'https://demo.abfallkalender.example/erinnerungen/abmelden?token=',
    );
  });

  it('builds reminder dispatch messages with cc, bcc and transport-level reply-to fallbacks', () => {
    const message = buildDispatchMessage({
      config: createReminderConfig({
        fromEmail: '',
        fromName: '',
        replyToEmail: undefined,
        serviceLabel: 'Configured Service',
      }),
      transport: createTransport(),
      payload: createReminderPayload({
        templatePayload: {
          ...createReminderPayload().templatePayload,
          serviceLabel: 'Payload Service',
        },
      }),
    });

    expect(message).toEqual({
      from: {
        email: 'transport@example.org',
        displayName: 'Transport Default',
      },
      to: [{ email: 'max@example.org' }],
      cc: [{ email: 'copy@example.org' }],
      bcc: [{ email: 'blind@example.org' }],
      replyTo: [{ email: 'transport-reply@example.org' }],
      subject: 'Abfalltermine',
      text: [
        'Nicht vergessen',
        'Liste',
        '- Papier (Di., 16.06.)',
        'Gruss',
        'Grund',
        'Abmelden: https://example.org/unsubscribe',
        'Datenschutz: https://example.org/privacy',
        'Impressum: https://example.org/imprint',
        'Service: Payload Service',
      ].join('\n\n'),
    });
  });

  it('builds DOI dispatch messages with payload reply-to and optional sections trimmed away', () => {
    const message = buildDispatchMessage({
      config: createReminderConfig({
        fromEmail: '',
        fromName: '',
        doiPreheader: '   ',
        doiFallbackText: '  ',
        doiExpiryNoticeText: undefined,
        serviceLabel: '  ',
        dataControllerLabel: '  ',
      }),
      transport: createTransport({
        defaultReplyToEmail: 'transport-reply@example.org',
      }),
      payload: createReminderPayload({
        templateKey: 'waste.email-reminder.doi',
        addresses: [
          { kind: 'to', email: 'max@example.org' },
          { kind: 'reply_to', email: 'payload-reply@example.org' },
        ],
        templatePayload: {
          subject: 'ignored',
          introText: 'ignored',
          listIntroText: '',
          outroText: '',
          reasonText: '',
          unsubscribeLabel: '',
          unsubscribeUrl: '',
          locationLabel: 'Perleberg',
          pickupDate: '',
          fractionName: '',
          privacyPolicyUrl: 'https://example.org/privacy',
          imprintUrl: 'https://example.org/imprint',
          confirmUrl: 'https://example.org/confirm',
          dataControllerLabel: 'Amt Prignitz',
          serviceLabel: 'Abfallservice',
        },
      }),
    });

    expect(message).toEqual({
      from: {
        email: 'transport@example.org',
        displayName: 'Transport Default',
      },
      to: [{ email: 'max@example.org' }],
      replyTo: [{ email: 'payload-reply@example.org' }],
      subject: 'Bitte Anmeldung fuer Perleberg bestaetigen',
      text: [
        'Bitte bestaetigen Sie Ihre Anmeldung fuer Perleberg.',
        'Ort: Perleberg',
        'Jetzt bestaetigen: https://example.org/confirm',
        'Service: Abfallservice',
        'Verantwortlich: Amt Prignitz',
        'Datenschutz: https://example.org/privacy',
        'Impressum: https://example.org/imprint',
      ].join('\n\n'),
    });
  });
});
