import { describe, expect, it } from 'vitest';

import {
  readPublicWasteBootstrapStateFromEnvironment,
  resolvePublicWasteBootstrapState,
} from './public-waste-bootstrap.server.js';

describe('public waste bootstrap', () => {
  it('returns a missing-config error state when no raw config is provided', () => {
    expect(resolvePublicWasteBootstrapState(undefined)).toMatchObject({
      status: 'error',
      reason: 'missing_config',
    });
  });

  it('returns an invalid-config error state when parsing fails', () => {
    expect(
      resolvePublicWasteBootstrapState({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toMatchObject({
      status: 'error',
      reason: 'invalid_config',
    });
  });

  it('prefers split PUBLIC_WASTE_* variables and only falls back to PUBLIC_WASTE_CONFIG_JSON when needed', () => {
    expect(
      readPublicWasteBootstrapStateFromEnvironment({
        env: {
          PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz-env',
          PUBLIC_WASTE_DATABASE_URL: 'postgres://env',
          PUBLIC_WASTE_SCHEMA_NAME: 'public-env',
          PUBLIC_WASTE_CONFIG_JSON: JSON.stringify({
            instanceId: 'bb-prignitz-json',
            supabase: { databaseUrl: 'postgres://json', schemaName: 'public-json' },
            emailReminderConfig: {
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
            },
          }),
        },
      })
    ).toMatchObject({
      status: 'ready',
      config: {
        instanceId: 'bb-prignitz-env',
        emailReminderConfig: {
          enabled: true,
          publicSignupEnabled: true,
        },
      },
    });

    expect(
      readPublicWasteBootstrapStateFromEnvironment({
        rawConfigJson: JSON.stringify({
          instanceId: 'bb-prignitz-json',
          supabase: { databaseUrl: 'postgres://json', schemaName: 'public-json' },
        }),
      })
    ).toMatchObject({
      status: 'ready',
      config: {
        instanceId: 'bb-prignitz-json',
      },
    });
  });
});
