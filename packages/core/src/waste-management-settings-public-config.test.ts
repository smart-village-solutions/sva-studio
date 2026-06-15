import { describe, expect, it } from 'vitest';

import {
  buildWasteManagementPublicConfig,
  findSelectedWasteManagementInterfaceRecord,
  isWasteManagementInterfaceSelected,
  readWasteManagementEmailReminderConfig,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
} from './waste-management-settings-public-config.js';
import type { ExternalInterfaceRecord } from './external-interfaces-contract.js';

const createInterfaceRecord = (
  input: Partial<ExternalInterfaceRecord> & Pick<ExternalInterfaceRecord, 'id' | 'typeKey'>
): ExternalInterfaceRecord => ({
  id: input.id,
  instanceId: input.instanceId ?? 'tenant-a',
  typeKey: input.typeKey,
  ownerKind: input.ownerKind ?? 'host',
  ownerId: input.ownerId ?? 'host',
  displayName: input.displayName ?? input.id,
  alias: input.alias ?? input.id,
  enabled: input.enabled ?? true,
  isDefault: input.isDefault ?? false,
  category: input.category ?? 'database',
  statusCheckKind: input.statusCheckKind ?? 'supabase',
  visibleStatus: input.visibleStatus ?? 'ok',
  publicConfig: input.publicConfig ?? {},
  secretConfigCiphertext: input.secretConfigCiphertext,
});

const createEmailReminderConfigInput = () => ({
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'mail-transport-1',
  publicBaseUrl: 'https://demo.abfallkalender.example/',
  doiConfirmPath: '/email-reminders/confirm',
  unsubscribePath: '/email-reminders/unsubscribe',
  signupSuccessPath: '/email-reminders/signed-up',
  activationSuccessPath: '/email-reminders/active',
  unsubscribeSuccessPath: '/email-reminders/unsubscribed',
  invalidTokenPath: '/email-reminders/invalid-token',
  fromName: 'Landkreis Musterstadt',
  fromEmail: 'abfall@example.org',
  replyToEmail: 'service@example.org',
  serviceLabel: 'Erinnerungsdienst',
  privacyPolicyUrl: 'https://example.org/privacy',
  imprintUrl: 'https://example.org/imprint',
  consentLabel: 'Ich stimme der Datenverarbeitung zu.',
  consentVersion: '2026-06-14',
  dataControllerLabel: 'Landkreis Musterstadt',
  dataProtectionContactEmail: 'datenschutz@example.org',
  doiSubjectTemplate: 'Bitte E-Mail-Erinnerung bestaetigen',
  doiPreheader: 'Bestaetigen Sie Ihre Anmeldung.',
  doiIntroText: 'Bitte bestaetigen Sie Ihre Anmeldung fuer den Erinnerungsdienst.',
  doiButtonLabel: 'Jetzt bestaetigen',
  doiFallbackText: 'Falls der Button nicht funktioniert, nutzen Sie den Direktlink.',
  doiExpiryNoticeText: 'Der Link ist 48 Stunden gueltig.',
  doiSuccessHeadline: 'Anmeldung bestaetigt',
  doiSuccessBody: 'Ihre E-Mail-Erinnerung ist jetzt aktiv.',
  doiErrorHeadline: 'Link ungueltig',
  doiErrorBody: 'Der Bestaetigungslink ist ungueltig oder abgelaufen.',
  reminderSubjectTemplate: 'Erinnerung: {{fractionName}} am {{pickupDate}}',
  reminderIntroTemplate: 'Die naechste Abholung fuer {{locationLabel}} ist bald.',
  reminderListIntroTemplate: 'Folgende Abholungen stehen an:',
  reminderOutroText: 'Viele Gruesse aus der Abfallwirtschaft.',
  unsubscribeLinkLabel: 'Erinnerung abbestellen',
  reminderReasonText: 'Sie erhalten diese E-Mail wegen Ihrer aktiven Erinnerung.',
  unsubscribeSuccessHeadline: 'Abmeldung erfolgreich',
  unsubscribeSuccessBody: 'Sie erhalten keine weiteren Erinnerungen.',
  unsubscribeAlreadyDoneHeadline: 'Bereits abgemeldet',
  unsubscribeAlreadyDoneBody: 'Diese Erinnerung war bereits deaktiviert.',
  unsubscribeErrorHeadline: 'Abmeldung fehlgeschlagen',
  unsubscribeErrorBody: 'Bitte fordern Sie einen neuen Link an.',
  maxSubscriptionsPerEmailAndLocation: 3,
  signupRateLimitPerIpPerHour: 10,
  signupRateLimitPerEmailPerHour: 5,
  doiTokenTtlHours: 48,
  pendingSubscriptionTtlHours: 72,
  materializationLookaheadDays: 7,
});

describe('waste-management-settings-public-config', () => {
  it('prefers the selected waste interface and falls back to default or generic supabase records', () => {
    const selectedSupabase = createInterfaceRecord({
      id: 'supabase-selected',
      typeKey: 'supabase',
      publicConfig: { wasteManagementSelected: true },
    });
    const defaultSupabase = createInterfaceRecord({
      id: 'supabase-default',
      typeKey: 'supabase',
      isDefault: true,
    });
    const genericSupabase = createInterfaceRecord({
      id: 'supabase-generic',
      typeKey: 'supabase',
    });
    const objectStorage = createInterfaceRecord({
      id: 's3-1',
      typeKey: 's3',
      category: 'object_storage',
      statusCheckKind: 's3',
    });

    expect(isWasteManagementInterfaceSelected(selectedSupabase)).toBe(true);
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, defaultSupabase, selectedSupabase])?.id).toBe(
      'supabase-selected'
    );
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, defaultSupabase])?.id).toBe('supabase-default');
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage, genericSupabase])?.id).toBe('supabase-generic');
    expect(findSelectedWasteManagementInterfaceRecord([objectStorage])).toBeNull();
  });

  it('ignores selected non-supabase records for waste interface selection', () => {
    const selectedObjectStorage = createInterfaceRecord({
      id: 's3-selected',
      typeKey: 's3',
      category: 'object_storage',
      statusCheckKind: 's3',
      publicConfig: { wasteManagementSelected: true },
    });
    const defaultSupabase = createInterfaceRecord({
      id: 'supabase-default',
      typeKey: 'supabase',
      isDefault: true,
    });

    expect(isWasteManagementInterfaceSelected(selectedObjectStorage)).toBe(true);
    expect(findSelectedWasteManagementInterfaceRecord([selectedObjectStorage, defaultSupabase])?.id).toBe(
      'supabase-default'
    );
  });

  it('reads and writes pdf-specific public config fields', () => {
    const current = {
      calendarWebUrl: 'https://calendar.example',
      pdfBrandingAssetUrl: 'https://old.example/logo.png',
      pdfContactBlock: 'old contact',
    } as const;

    const next = buildWasteManagementPublicConfig(current, {
      selected: true,
      calendarWebUrl: 'https://calendar.example',
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });

    expect(readWasteManagementPdfBrandingAssetUrl(next)).toBe('https://cdn.example/logo.svg');
    expect(readWasteManagementPdfContactBlock(next)).toBe('Abfallberatung 03395 / 1234');
  });

  it('removes pdf-specific keys when empty values are written', () => {
    const next = buildWasteManagementPublicConfig(
      {
        pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
        pdfContactBlock: 'Abfallberatung 03395 / 1234',
      },
      {
        selected: false,
      }
    );

    expect(readWasteManagementPdfBrandingAssetUrl(next)).toBeUndefined();
    expect(readWasteManagementPdfContactBlock(next)).toBeUndefined();
  });

  it('reads and clears holiday sync metadata fields', () => {
    const next = buildWasteManagementPublicConfig(
      {},
      {
        selected: false,
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        lastSuccessfulHolidaySyncAt: '2026-05-10T10:00:00.000Z',
      }
    );

    expect(readWasteManagementHolidayStateCode(next)).toBe('NW');
    expect(readWasteManagementHolidaySyncStatus(next)).toBe('success');
    expect(readWasteManagementLastSuccessfulHolidaySyncAt(next)).toBe('2026-05-10T10:00:00.000Z');

    const cleared = buildWasteManagementPublicConfig(next, {
      selected: false,
    });

    expect(readWasteManagementHolidayStateCode(cleared)).toBeUndefined();
    expect(readWasteManagementHolidaySyncStatus(cleared)).toBeUndefined();
    expect(readWasteManagementLastSuccessfulHolidaySyncAt(cleared)).toBeUndefined();
  });

  it('reads and writes waste email reminder output config', () => {
    const next = buildWasteManagementPublicConfig({}, {
      selected: true,
      calendarWebUrl: 'https://demo.abfallkalender.example',
      emailReminderConfig: createEmailReminderConfigInput(),
    });

    expect(readWasteManagementEmailReminderConfig(next)).toEqual(createEmailReminderConfigInput());
  });

  it('rejects malformed nested email reminder config payloads', () => {
    expect(readWasteManagementEmailReminderConfig({ emailReminderConfig: 'invalid' })).toBeUndefined();
    expect(readWasteManagementEmailReminderConfig({ emailReminderConfig: [] })).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          doiSubjectTemplate: '   ',
        },
      })
    ).toBeUndefined();
  });

  it('rejects malformed boolean fields in email reminder config', () => {
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          enabled: 'true',
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicSignupEnabled: 1,
        },
      })
    ).toBeUndefined();
  });

  it('rejects non-positive and non-integer numeric limits in email reminder config', () => {
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          doiTokenTtlHours: 0,
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          signupRateLimitPerIpPerHour: -1,
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          materializationLookaheadDays: 7.5,
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          materializationLookaheadDays: 15,
        },
      })
    ).toBeUndefined();
  });

  it('normalizes email reminder config strings on write and supports round-trip reads', () => {
    const next = buildWasteManagementPublicConfig(
      {
        emailReminderConfig: {
          stale: true,
        },
      },
      {
        selected: true,
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          transportId: '  mail-transport-1  ',
          publicBaseUrl: '  https://demo.abfallkalender.example  ',
          fromName: '  Landkreis Musterstadt  ',
          replyToEmail: '   ',
          serviceLabel: '  Erinnerungsdienst  ',
          reminderOutroText: '  Viele Gruesse aus der Abfallwirtschaft.  ',
        },
      }
    );

    expect(next).toMatchObject({
      emailReminderConfig: {
        transportId: 'mail-transport-1',
        publicBaseUrl: 'https://demo.abfallkalender.example/',
        fromName: 'Landkreis Musterstadt',
        serviceLabel: 'Erinnerungsdienst',
        reminderOutroText: 'Viele Gruesse aus der Abfallwirtschaft.',
      },
    });
    expect((next.emailReminderConfig as Record<string, unknown>).replyToEmail).toBeUndefined();
    const { replyToEmail: _replyToEmail, ...expectedConfig } = createEmailReminderConfigInput();
    expect(readWasteManagementEmailReminderConfig(next)).toEqual({
      ...expectedConfig,
      transportId: 'mail-transport-1',
      publicBaseUrl: 'https://demo.abfallkalender.example/',
      fromName: 'Landkreis Musterstadt',
      serviceLabel: 'Erinnerungsdienst',
      reminderOutroText: 'Viele Gruesse aus der Abfallwirtschaft.',
    });
  });

  it('keeps the previous email reminder config when a write payload is invalid', () => {
    const current = buildWasteManagementPublicConfig(
      {},
      {
        selected: true,
        emailReminderConfig: createEmailReminderConfigInput(),
      }
    );

    const next = buildWasteManagementPublicConfig(current, {
      selected: true,
      emailReminderConfig: {
        ...createEmailReminderConfigInput(),
        fromEmail: 'invalid-address',
      },
    });

    expect(readWasteManagementEmailReminderConfig(next)).toEqual(createEmailReminderConfigInput());
  });

  it('preserves the previous email reminder config when partial writes omit the field', () => {
    const current = buildWasteManagementPublicConfig(
      {},
      {
        selected: true,
        emailReminderConfig: createEmailReminderConfigInput(),
      }
    );

    const next = buildWasteManagementPublicConfig(current, {
      selected: true,
      holidayStateCode: 'NW',
    });

    expect(readWasteManagementEmailReminderConfig(next)).toEqual(createEmailReminderConfigInput());
  });

  it('preserves valid absolute urls with trailing slash, query string, and hash fragments', () => {
    const next = buildWasteManagementPublicConfig(
      {},
      {
        selected: true,
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicBaseUrl: 'https://demo.abfallkalender.example/app/?ref=mail#top',
          privacyPolicyUrl: 'https://example.org/privacy/?v=1#details',
          imprintUrl: 'https://example.org/imprint/#legal',
        },
      }
    );

    expect(readWasteManagementEmailReminderConfig(next)).toMatchObject({
      publicBaseUrl: 'https://demo.abfallkalender.example/app/?ref=mail#top',
      privacyPolicyUrl: 'https://example.org/privacy/?v=1#details',
      imprintUrl: 'https://example.org/imprint/#legal',
    });
  });

  it('accepts local dev public base urls for localhost and loopback variants', () => {
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicBaseUrl: 'http://localhost:3000',
        },
      })?.publicBaseUrl
    ).toBe('http://localhost:3000/');
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicBaseUrl: 'http://127.0.0.1:3000',
        },
      })?.publicBaseUrl
    ).toBe('http://127.0.0.1:3000/');
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicBaseUrl: 'http://[::1]:3000',
        },
      })?.publicBaseUrl
    ).toBe('http://[::1]:3000/');
  });

  it('keeps recommended doi and reminder texts optional where the spec does not require them', () => {
    const {
      doiPreheader: _doiPreheader,
      doiFallbackText: _doiFallbackText,
      doiExpiryNoticeText: _doiExpiryNoticeText,
      doiSuccessHeadline: _doiSuccessHeadline,
      doiSuccessBody: _doiSuccessBody,
      doiErrorHeadline: _doiErrorHeadline,
      doiErrorBody: _doiErrorBody,
      reminderListIntroTemplate: _reminderListIntroTemplate,
      reminderOutroText: _reminderOutroText,
      reminderReasonText: _reminderReasonText,
      ...minimalConfig
    } = createEmailReminderConfigInput();

    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: minimalConfig,
      })
    ).toEqual(minimalConfig);
  });

  it('rejects invalid urls, paths, and email fields in email reminder config', () => {
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          publicBaseUrl: '/relative-only',
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          privacyPolicyUrl: 'not-a-url',
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          doiConfirmPath: 'https://evil.example/confirm',
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          fromEmail: 'invalid-address',
        },
      })
    ).toBeUndefined();
    expect(
      readWasteManagementEmailReminderConfig({
        emailReminderConfig: {
          ...createEmailReminderConfigInput(),
          dataProtectionContactEmail: 'also-invalid',
        },
      })
    ).toBeUndefined();
  });
});
