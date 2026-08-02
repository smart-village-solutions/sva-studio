import { describe, expect, it } from 'vitest';
import { deriveWasteTenantDatabaseNames } from '@sva/server-runtime';

import {
  parsePublicWasteConfig,
  readPublicWasteConfigFromEnvironment,
} from './public-waste-config.server.js';

const databaseUrlFor = (instanceId: string): string => {
  const names = deriveWasteTenantDatabaseNames(instanceId);
  return `postgresql://${names.publicAppRole}:secret@postgres:5432/${names.database}`;
};

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
        database: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toThrow('public_waste_config_invalid');
  });

  it('reads production config from split PUBLIC_WASTE_* environment variables', () => {
    const databaseUrl = databaseUrlFor('bb-prignitz');
    expect(
      readPublicWasteConfigFromEnvironment({
        PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
        PUBLIC_WASTE_DATABASE_URL: databaseUrl,
        PUBLIC_WASTE_SCHEMA_NAME: 'public',
        PUBLIC_WASTE_CONFIG_JSON: JSON.stringify({
          instanceId: 'ignored',
          database: {
            databaseUrl: 'postgres://ignored',
            schemaName: 'ignored',
          },
          emailReminderConfig: reminderConfigFixture,
          emailReminderSigningSecret: 'secret-1',
        }),
      })
    ).toEqual({
      instanceId: 'bb-prignitz',
      database: {
        databaseUrl,
        schemaName: 'public',
      },
      emailReminderConfig: reminderConfigFixture,
      emailReminderSigningSecret: 'secret-1',
    });
  });

  it('rejects a database URL belonging to another tenant', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: 'bb-prignitz',
        database: {
          databaseUrl: databaseUrlFor('bb-guben'),
          schemaName: 'public',
        },
      })
    ).toThrow('public_waste_config_invalid');
  });

  it('rejects non-public schemas for a tenant database', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: 'bb-prignitz',
        database: {
          databaseUrl: databaseUrlFor('bb-prignitz'),
          schemaName: 'waste',
        },
      })
    ).toThrow('public_waste_config_invalid');
  });
});
