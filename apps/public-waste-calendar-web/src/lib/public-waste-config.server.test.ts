import { describe, expect, it } from 'vitest';

import {
  parsePublicWasteConfig,
  readPublicWasteConfigFromEnvironment,
} from './public-waste-config.server.js';

describe('public waste config', () => {
  const reminderConfigFixture = {
    enabled: true,
    publicSignupEnabled: true,
    transportId: 'mail-1',
    publicBaseUrl: 'https://example.invalid/',
    doiConfirmPath: '/erinnerungen/bestaetigen',
    unsubscribePath: '/erinnerungen/abmelden',
    fromName: 'Abfallwirtschaft',
    fromEmail: 'abfall@example.invalid',
    privacyPolicyUrl: 'https://example.invalid/datenschutz',
    imprintUrl: 'https://example.invalid/impressum',
    consentLabel: 'Ich stimme zu.',
    consentVersion: 'v1',
    doiSubjectTemplate: 'Bitte bestaetigen',
    doiIntroText: 'Bitte bestaetigen.',
    doiButtonLabel: 'Bestaetigen',
    doiSuccessHeadline: 'Aktiviert',
    doiSuccessBody: 'Ihre Erinnerung ist aktiv.',
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
  } as const;

  it('rejects incomplete server-only config deterministically', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toThrow('public_waste_config_invalid');
  });

  it('reads production config from split PUBLIC_WASTE_* environment variables', () => {
    expect(
      readPublicWasteConfigFromEnvironment({
        PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
        PUBLIC_WASTE_DATABASE_URL: 'postgres://example',
        PUBLIC_WASTE_SCHEMA_NAME: 'public',
        PUBLIC_WASTE_CONFIG_JSON: JSON.stringify({
          instanceId: 'ignored',
          supabase: {
            databaseUrl: 'postgres://ignored',
            schemaName: 'ignored',
          },
          emailReminderConfig: reminderConfigFixture,
          emailReminderSigningSecret: 'secret-1',
        }),
      })
    ).toEqual({
      instanceId: 'bb-prignitz',
      supabase: {
        databaseUrl: 'postgres://example',
        schemaName: 'public',
      },
      emailReminderConfig: reminderConfigFixture,
      emailReminderSigningSecret: 'secret-1',
    });
  });
});
