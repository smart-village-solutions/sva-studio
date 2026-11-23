import { describe, expect, it } from 'vitest';

import type { MailDispatchPayload, MailTransportConfig } from '@sva/core';
import type {
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteManagementEmailReminderConfig,
} from '@sva/waste-management-contracts';

import {
  buildDispatchMessage,
  buildReminderDispatchPayload,
} from './waste-management-email-reminder-dispatch.server';
import {
  addDaysUtc,
  createUtcIsoAtHour,
  groupReminderMembers,
  matchSelectionLocations,
  parseIsoDateUtc,
  reminderMemberDedupeKey,
  selectUnreservedReminderGroups,
} from './waste-management-email-reminder-planning';

const createReminderConfig = (
  overrides: Partial<WasteManagementEmailReminderConfig> = {}
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
  overrides: Partial<Extract<MailTransportConfig, { transportType: 'smtp' }>> = {}
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
  overrides: Partial<MailDispatchPayload> = {}
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

const createDoiPayload = (overrides: Partial<MailDispatchPayload> = {}): MailDispatchPayload => ({
  ...createReminderPayload(),
  templateKey: 'waste.email-reminder.doi',
  addresses: [{ kind: 'to', email: 'recipient@invalid.example' }],
  templatePayload: {
    subject: 'ignored by DOI composition',
    introText: 'ignored by DOI composition',
    listIntroText: '',
    outroText: '',
    reasonText: '',
    unsubscribeLabel: '',
    unsubscribeUrl: '',
    locationLabel: 'Testort',
    pickupDate: '',
    fractionName: '',
    privacyPolicyUrl: 'https://invalid.example/privacy',
    imprintUrl: 'https://invalid.example/imprint',
    confirmUrl: 'https://invalid.example/confirm',
  },
  ...overrides,
});

const paperFraction: WasteFractionRecord = {
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
};

describe('waste email reminder dispatch helpers', () => {
  it('builds UTC dates and rejects invalid pickup dates', () => {
    expect(createUtcIsoAtHour(new Date('2026-06-15T12:30:00.000Z'), 6)).toBe(
      '2026-06-15T06:00:00.000Z'
    );
    expect(addDaysUtc(new Date('2026-06-15T00:00:00.000Z'), 2).toISOString()).toBe(
      '2026-06-17T00:00:00.000Z'
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
      }).map((location) => location.id)
    ).toEqual(['legacy-region-match', 'all-street-match']);

    expect(
      matchSelectionLocations(locations, {
        cityId: 'city-1',
        streetId: 'all',
      }).map((location) => location.id)
    ).toEqual(['all-street-match']);

    expect(
      matchSelectionLocations(locations, {
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
      }).map((location) => location.id)
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
      locationLabel: 'Gumtow, Alle Straßen Alle Hausnummern',
      pickupDate: '2026-06-16',
      originalSendAt: '2026-06-15T06:00:00.000Z',
      members: [{
        fraction: paperFraction,
        slotId: 'paper:first',
        hints: [
          '<p>Behälter <strong>am Vorabend</strong> bereitstellen.</p>',
          '<ul><li>Zufahrt freihalten</li></ul><script>alert(1)</script>',
          '<p>Behälter <strong>am Vorabend</strong> bereitstellen.</p>',
        ],
      }],
      unsubscribeTokenHash: 'sha256:unsubscribe',
      unsubscribeTokenSecret: 'secret',
    });

    expect(payload.addresses).toEqual([{ kind: 'to', email: 'max@example.org' }]);
    expect(payload.templatePayload).not.toHaveProperty('serviceLabel');
    expect(payload.templatePayload.locationLabel).toBe('Gumtow');
    expect(payload.templatePayload.subject).toBe('Abfalltermine fuer Gumtow');
    expect(JSON.parse(payload.templatePayload.reminderAppointments)).toEqual([{
      fractionName: paperFraction.name,
      hintText: ['Behälter am Vorabend bereitstellen.', '', '- Zufahrt freihalten'].join('\n'),
    }]);
    expect(payload.templatePayload.unsubscribeUrl).toContain(
      'https://demo.abfallkalender.example/erinnerungen/abmelden?token='
    );
  });

  it('groups only identical subscription, effective pickup date and original send time', () => {
    const base = {
      subscriptionId: 'subscription-1',
      pickupDate: '2027-01-04',
      originalSendAt: '2027-01-03T06:00:00.000Z',
      slotId: 'slot:first',
      fraction: paperFraction,
    };
    const groups = groupReminderMembers([
      base,
      { ...base, slotId: 'slot:second' },
      { ...base, fraction: { id: 'residual', name: 'Hausmüll' } },
      { ...base, originalSendAt: '2027-01-02T06:00:00.000Z' },
      { ...base, pickupDate: '2027-01-05' },
      { ...base, subscriptionId: 'subscription-2' },
    ]);
    expect(groups).toHaveLength(4);
    expect(groups[0]).toMatchObject({
      dedupeKey: 'reminder-group:subscription-1:2027-01-04:2027-01-03T06:00:00.000Z',
      originalSendAt: base.originalSendAt,
      members: [
        { fraction: paperFraction, slotId: 'slot:first' },
        { fraction: paperFraction, slotId: 'slot:second' },
        { fraction: { id: 'residual' }, slotId: 'slot:first' },
      ],
    });
  });

  it('keeps sent and started members out of a new group and freezes started groups', () => {
    const delivery = {
      subscriptionId: 'subscription-1',
      pickupDate: '2027-01-04',
      originalSendAt: '2027-01-03T06:00:00.000Z',
    };
    const paper = { slotId: 'slot:first', fraction: paperFraction };
    const residual = { slotId: 'slot:first', fraction: { id: 'residual', name: 'Hausmüll' } };
    const bio = { slotId: 'slot:first', fraction: { id: 'bio', name: 'Bioabfall' } };
    const [group] = groupReminderMembers(
      [paper, residual, bio].map((member) => ({ ...delivery, ...member }))
    );
    expect(group).toBeDefined();
    if (!group) return;
    const memberKey = (member: typeof paper | typeof residual | typeof bio) =>
      reminderMemberDedupeKey(delivery.subscriptionId, delivery.pickupDate, member);
    expect(
      selectUnreservedReminderGroups(
        [group],
        [
          { dedupeKey: memberKey(paper), status: 'sent', attemptCount: 1 },
          { dedupeKey: memberKey(residual), status: 'processing', attemptCount: 1 },
          { dedupeKey: memberKey(bio), status: 'pending', attemptCount: 0 },
        ]
      )
    ).toEqual([{ ...group, members: [bio] }]);
    expect(
      selectUnreservedReminderGroups(
        [group],
        [
          {
            dedupeKey: group.dedupeKey,
            status: 'failed',
            attemptCount: 1,
            memberKeys: [memberKey(paper)],
          },
        ]
      )
    ).toEqual([]);
    expect(
      selectUnreservedReminderGroups(
        [group],
        [
          {
            dedupeKey: 'earlier-group',
            status: 'pending',
            attemptCount: 1,
            memberKeys: [memberKey(bio)],
          },
        ]
      )
    ).toEqual([{ ...group, members: [paper, residual] }]);
  });

  it('renders all fractions and their own hints from a persisted group payload', () => {
    const config = createReminderConfig({
      reminderSubjectTemplate: 'Abholung {{fractionName}}',
      reminderIntroTemplate: 'Am {{pickupDate}} werden {{fractionName}} abgeholt.',
    });
    const payload = buildReminderDispatchPayload({
      config,
      subscriptionId: 'subscription-1',
      email: 'max@example.org',
      locationLabel: 'Gumtow',
      originalSendAt: '2027-01-03T06:00:00.000Z',
      pickupDate: '2027-01-04',
      members: [
        { fraction: paperFraction, slotId: 'slot:first', hints: ['<p>Papier bündeln.</p>'] },
        { fraction: paperFraction, slotId: 'slot:second', hints: ['<p>Papier bündeln.</p>'] },
        {
          fraction: { id: 'residual', name: 'Hausmüll' },
          slotId: 'slot:first',
          hints: ['Behälter bereitstellen.'],
        },
      ],
      unsubscribeTokenHash: 'sha256:unsubscribe',
      unsubscribeTokenSecret: 'secret',
    });
    expect(payload.metadata).toMatchObject({
      originalSendAt: '2027-01-03T06:00:00.000Z',
      pickupDate: '2027-01-04',
      reminderMemberKeys: JSON.stringify(
        [
          `reminder:subscription-1:${paperFraction.id}:slot:first:2027-01-04`,
          `reminder:subscription-1:${paperFraction.id}:slot:second:2027-01-04`,
          'reminder:subscription-1:residual:slot:first:2027-01-04',
        ].sort()
      ),
    });
    const names = `Hausmüll, ${paperFraction.name}`;
    expect(payload.templatePayload.fractionName).toBe(names);
    const storedPayload = JSON.parse(JSON.stringify(payload)) as MailDispatchPayload;
    const message = buildDispatchMessage({
      config,
      transport: createTransport(),
      payload: storedPayload,
    });
    expect(message.subject).toBe(`Abholung ${names}`);
    expect(message.text).toContain(
      [
        `- Hausmüll (${payload.templatePayload.pickupDate})`,
        '  Behälter bereitstellen.',
        `- ${paperFraction.name} (${payload.templatePayload.pickupDate})`,
        '  Papier bündeln.',
      ].join('\n')
    );
    expect(message.text.split(payload.templatePayload.unsubscribeUrl)).toHaveLength(2);
  });

  it('rejects malformed group content before rendering a dispatch message', () => {
    const payload = createReminderPayload();
    expect(() =>
      buildDispatchMessage({
        config: createReminderConfig(),
        transport: createTransport(),
        payload: {
          ...payload,
          templatePayload: { ...payload.templatePayload, reminderAppointments: '[{}]' },
        },
      })
    ).toThrow('invalid_reminder_appointments');
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
          hintText: 'Behälter am Vorabend bereitstellen.\n\n- Zufahrt freihalten',
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
        [
          '- Papier (Di., 16.06.)',
          '  Behälter am Vorabend bereitstellen.',
          '',
          '  - Zufahrt freihalten',
        ].join('\n'),
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

  it('preserves the complete DOI section order, template rendering and payload address priority', () => {
    const message = buildDispatchMessage({
      config: createReminderConfig({
        fromEmail: 'configured-from@invalid.example',
        fromName: 'Configured Sender',
        replyToEmail: 'configured-reply@invalid.example',
        serviceLabel: 'Configured Service',
        dataControllerLabel: 'Configured Controller',
        doiSubjectTemplate: 'DOI {{locationLabel}} {{unknownPlaceholder}}',
        doiPreheader: 'Preheader {{serviceLabel}}',
        doiIntroText: 'Intro {{locationLabel}}',
        doiButtonLabel: 'Confirm',
        doiFallbackText: 'Fallback {{confirmUrl}}',
        doiExpiryNoticeText: 'Expiry {{expiryHours}} hours for {{dataControllerLabel}}',
      }),
      transport: createTransport({
        defaultFromEmail: 'transport-from@invalid.example',
        defaultFromName: 'Transport Sender',
        defaultReplyToEmail: 'transport-reply@invalid.example',
      }),
      payload: createDoiPayload({
        addresses: [
          {
            kind: 'to',
            email: 'recipient@invalid.example',
            displayName: 'Synthetic Recipient',
          },
          { kind: 'cc', email: 'copy@invalid.example', displayName: 'Synthetic Copy' },
          { kind: 'bcc', email: 'blind@invalid.example' },
          {
            kind: 'reply_to',
            email: 'payload-reply@invalid.example',
            displayName: 'Synthetic Reply',
          },
        ],
        templatePayload: {
          ...createDoiPayload().templatePayload,
          locationLabel: 'Payload Place',
          serviceLabel: 'Payload Service',
          dataControllerLabel: 'Payload Controller',
        },
      }),
    });

    expect(message).toEqual({
      from: {
        email: 'configured-from@invalid.example',
        displayName: 'Configured Sender',
      },
      to: [
        {
          email: 'recipient@invalid.example',
          displayName: 'Synthetic Recipient',
        },
      ],
      cc: [{ email: 'copy@invalid.example', displayName: 'Synthetic Copy' }],
      bcc: [{ email: 'blind@invalid.example' }],
      replyTo: [
        {
          email: 'payload-reply@invalid.example',
          displayName: 'Synthetic Reply',
        },
      ],
      subject: 'DOI Payload Place ',
      text: [
        'Preheader Payload Service',
        'Intro Payload Place',
        'Ort: Payload Place',
        'Confirm: https://invalid.example/confirm',
        'Fallback https://invalid.example/confirm',
        'Expiry 48 hours for Payload Controller',
        'Service: Payload Service',
        'Verantwortlich: Payload Controller',
        'Datenschutz: https://invalid.example/privacy',
        'Impressum: https://invalid.example/imprint',
      ].join('\n\n'),
    });
  });

  it.each([
    ['Gumtow, Alle Straßen', 'Gumtow'],
    ['Gumtow, Alle Straßen Alle Hausnummern', 'Gumtow'],
    ['Gumtow, alle Straßen und Hausnummern', 'Gumtow'],
    ['Perleberg, Pferdeschwemme Alle Hausnummern', 'Perleberg, Pferdeschwemme'],
    [' Perleberg , Pferdeschwemme , Alle Hausnummern ', 'Perleberg, Pferdeschwemme'],
    ['Perleberg, Pferdeschwemme 2', 'Perleberg, Pferdeschwemme 2'],
    ['Perleberg, Pferdeschwemme 2-8', 'Perleberg, Pferdeschwemme 2-8'],
  ])('shortens %s in both rendered mail types', (locationLabel, expected) => {
    const config = createReminderConfig({
      reminderIntroTemplate: 'Adresse: {{locationLabel}}.',
      reminderReasonText: 'Erinnerung für {{locationLabel}}.',
    });
    const transport = createTransport();
    const doi = buildDispatchMessage({
      config,
      transport,
      payload: createDoiPayload({
        templatePayload: {
          ...createDoiPayload().templatePayload,
          locationLabel,
        },
      }),
    });
    const reminderPayload = buildReminderDispatchPayload({
      config,
      subscriptionId: 'subscription-1',
      email: 'recipient@invalid.example',
      locationLabel,
      pickupDate: '2026-06-16',
      originalSendAt: '2026-06-15T06:00:00.000Z',
      members: [{ fraction: paperFraction, slotId: 'paper:first' }],
      unsubscribeTokenHash: 'sha256:unsubscribe',
      unsubscribeTokenSecret: 'secret',
    });
    const reminder = buildDispatchMessage({ config, transport, payload: reminderPayload });

    expect(doi.subject).toBe(`Bitte Anmeldung fuer ${expected} bestaetigen`);
    expect(doi.text).toContain(`Bitte bestaetigen Sie Ihre Anmeldung fuer ${expected}.`);
    expect(doi.text).toContain(`Ort: ${expected}\n`);
    expect(reminderPayload.templatePayload.locationLabel).toBe(expected);
    expect(reminder.subject).toBe(`Abfalltermine fuer ${expected}`);
    expect(reminder.text).toContain(`Adresse: ${expected}.`);
    expect(reminder.text).toContain(`Erinnerung für ${expected}.`);
  });

  it.each([
    ['Gumtow, alle Straßen und Hausnummern', 'Gumtow'],
    ['Perleberg, Pferdeschwemme Alle Hausnummern', 'Perleberg, Pferdeschwemme'],
  ])('updates %s in an already rendered reminder', (locationLabel, expected) => {
    const payload = createReminderPayload({
      templatePayload: {
        ...createReminderPayload().templatePayload,
        locationLabel,
        subject: `Archivierter Betreff: ${locationLabel}`,
        introText: `Archivierte Einleitung für ${locationLabel}.`,
        listIntroText: `Für ${locationLabel} gilt:`,
        reasonText: `Abonniert für ${locationLabel}.`,
        hintText: 'Alle Hausnummern sind im Tourenplan erfasst.',
      },
    });
    const message = buildDispatchMessage({
      config: createReminderConfig(),
      transport: createTransport(),
      payload,
    });

    expect(message.subject).toBe(`Archivierter Betreff: ${expected}`);
    expect(message.text).toContain(`Archivierte Einleitung für ${expected}.`);
    expect(message.text).toContain(`Für ${expected} gilt:`);
    expect(message.text).toContain(`Abonniert für ${expected}.`);
    expect(message.text).toContain('Alle Hausnummern sind im Tourenplan erfasst.');
  });

  it('uses configured DOI labels only when payload labels are absent', () => {
    const configuredFallback = buildDispatchMessage({
      config: createReminderConfig({
        serviceLabel: 'Configured Service',
        dataControllerLabel: 'Configured Controller',
        doiPreheader: undefined,
        doiFallbackText: undefined,
        doiExpiryNoticeText: undefined,
      }),
      transport: createTransport(),
      payload: createDoiPayload(),
    });
    const payloadWhitespace = buildDispatchMessage({
      config: createReminderConfig({
        serviceLabel: 'Configured Service',
        dataControllerLabel: 'Configured Controller',
        doiPreheader: undefined,
        doiFallbackText: undefined,
        doiExpiryNoticeText: undefined,
      }),
      transport: createTransport(),
      payload: createDoiPayload({
        templatePayload: {
          ...createDoiPayload().templatePayload,
          serviceLabel: '   ',
          dataControllerLabel: '',
        },
      }),
    });

    expect(configuredFallback.text).toContain('Service: Configured Service');
    expect(configuredFallback.text).toContain('Verantwortlich: Configured Controller');
    expect(payloadWhitespace.text).not.toContain('Service:');
    expect(payloadWhitespace.text).not.toContain('Verantwortlich:');
  });

  it.each([
    {
      name: 'configured reply-to before transport',
      configReplyTo: 'configured-reply@invalid.example',
      transportReplyTo: 'transport-reply@invalid.example',
      expectedReplyTo: [{ email: 'configured-reply@invalid.example' }],
    },
    {
      name: 'transport reply-to when configuration is absent',
      configReplyTo: undefined,
      transportReplyTo: 'transport-reply@invalid.example',
      expectedReplyTo: [{ email: 'transport-reply@invalid.example' }],
    },
    {
      name: 'no reply-to when every fallback is absent',
      configReplyTo: undefined,
      transportReplyTo: undefined,
      expectedReplyTo: undefined,
    },
  ])('$name', ({ configReplyTo, transportReplyTo, expectedReplyTo }) => {
    const message = buildDispatchMessage({
      config: createReminderConfig({
        replyToEmail: configReplyTo,
        doiPreheader: undefined,
        doiFallbackText: undefined,
        doiExpiryNoticeText: undefined,
      }),
      transport: createTransport({ defaultReplyToEmail: transportReplyTo }),
      payload: createDoiPayload(),
    });

    expect(message.replyTo).toEqual(expectedReplyTo);
  });

  it('preserves empty DOI values and the button-label fallback without normalizing the contract', () => {
    const message = buildDispatchMessage({
      config: createReminderConfig({
        fromEmail: '',
        fromName: '',
        replyToEmail: undefined,
        doiSubjectTemplate: '{{locationLabel}}/{{unknownPlaceholder}}',
        doiPreheader: 'Rendered blank: {{unknownPlaceholder}}',
        doiIntroText: 'Intro {{locationLabel}}',
        doiButtonLabel: '',
        doiFallbackText: '   ',
        doiExpiryNoticeText: '',
        serviceLabel: undefined,
        dataControllerLabel: undefined,
      }),
      transport: createTransport({
        defaultFromEmail: '',
        defaultFromName: '',
        defaultReplyToEmail: undefined,
      }),
      payload: createDoiPayload({
        templatePayload: {
          ...createDoiPayload().templatePayload,
          locationLabel: '   ',
          confirmUrl: '',
          privacyPolicyUrl: '',
          imprintUrl: '',
        },
      }),
    });

    expect(message).toEqual({
      from: { email: '', displayName: undefined },
      to: [{ email: 'recipient@invalid.example' }],
      subject: '   /',
      text: ['Rendered blank:', 'Intro', 'Datenschutz:', 'Impressum:'].join('\n\n'),
    });
  });

  it('keeps unknown template keys on the existing reminder dispatch path', () => {
    const message = buildDispatchMessage({
      config: createReminderConfig(),
      transport: createTransport(),
      payload: createReminderPayload({ templateKey: 'waste.email-reminder.unknown' }),
    });

    expect(message.subject).toBe('Abfalltermine');
    expect(message.text).toContain('- Papier (Di., 16.06.)');
    expect(message.text).not.toContain('Jetzt bestaetigen');
  });
});
