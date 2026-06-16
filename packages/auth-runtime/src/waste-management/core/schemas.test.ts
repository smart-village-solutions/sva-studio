import { describe, expect, it } from 'vitest';

import { wasteManagementMasterDataSchemas, wasteManagementSettingsSchemas } from './schemas.js';

describe('waste-management schemas', () => {
  const baseSettingsPayload = {
    provider: 'supabase' as const,
    projectUrl: 'https://tenant.example.test',
    enabled: true,
    customRecurrencePresets: [],
    deletedPresetFallbacks: {},
  };

  it('rejects reminder slots whose default lead days exceed the configured maximum', () => {
    const result = wasteManagementMasterDataSchemas.createWasteFractionSchema.safeParse({
      id: 'fraction-1',
      name: 'Bio',
      pdfShortLabel: 'BIO',
      color: '#00AA00',
      active: true,
      reminderConfig: {
        reminderCount: 'once',
        channels: {
          push: true,
          email: false,
          calendar: false,
        },
        push: {
          slots: [
            {
              id: 'slot-1',
              maxLeadDays: 2,
              defaultLeadDays: 3,
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['reminderConfig', 'push', 'slots', 0, 'defaultLeadDays'],
        }),
      ])
    );
  });

  it('accepts localhost http public base urls and rejects insecure remote ones in email reminder settings', () => {
    const basePayload = {
      enabled: true,
      publicSignupEnabled: true,
      transportId: 'mail-1',
      doiConfirmPath: '/confirm',
      unsubscribePath: '/unsubscribe',
      fromName: 'Waste Team',
      fromEmail: 'waste@example.test',
      privacyPolicyUrl: 'https://example.test/privacy',
      imprintUrl: 'https://example.test/imprint',
      consentLabel: 'Einverstanden',
      consentVersion: 'v1',
      doiSubjectTemplate: 'Bitte bestaetigen',
      doiIntroText: 'Bitte bestaetigen Sie die Anmeldung.',
      doiButtonLabel: 'Bestaetigen',
      reminderSubjectTemplate: 'Erinnerung',
      reminderIntroTemplate: 'Morgen wird abgeholt.',
      unsubscribeLinkLabel: 'Abmelden',
      unsubscribeSuccessHeadline: 'Abmeldung erfolgreich',
      unsubscribeSuccessBody: 'Sie wurden erfolgreich abgemeldet.',
      maxSubscriptionsPerEmailAndLocation: 3,
      signupRateLimitPerIpPerHour: 10,
      signupRateLimitPerEmailPerHour: 5,
      doiTokenTtlHours: 48,
      pendingSubscriptionTtlHours: 72,
      materializationLookaheadDays: 7,
    };

    expect(
      wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
        ...baseSettingsPayload,
        emailReminderConfig: {
          ...basePayload,
          publicBaseUrl: 'http://localhost:3000',
        },
      }).success
    ).toBe(true);

    const invalidResult = wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
      ...baseSettingsPayload,
      emailReminderConfig: {
        ...basePayload,
        publicBaseUrl: 'http://example.test',
      },
    });
    expect(invalidResult.success).toBe(false);
  });

  it('rejects malformed email reminder addresses with doubled dots while accepting plus addressing', () => {
    const basePayload = {
      enabled: true,
      publicSignupEnabled: true,
      transportId: 'mail-1',
      doiConfirmPath: '/confirm',
      unsubscribePath: '/unsubscribe',
      fromName: 'Waste Team',
      fromEmail: 'waste+team@example.test',
      replyToEmail: 'reply+mail@example.test',
      privacyPolicyUrl: 'https://example.test/privacy',
      imprintUrl: 'https://example.test/imprint',
      consentLabel: 'Einverstanden',
      consentVersion: 'v1',
      doiSubjectTemplate: 'Bitte bestaetigen',
      doiIntroText: 'Bitte bestaetigen Sie die Anmeldung.',
      doiButtonLabel: 'Bestaetigen',
      reminderSubjectTemplate: 'Erinnerung',
      reminderIntroTemplate: 'Morgen wird abgeholt.',
      unsubscribeLinkLabel: 'Abmelden',
      unsubscribeSuccessHeadline: 'Abmeldung erfolgreich',
      unsubscribeSuccessBody: 'Sie wurden erfolgreich abgemeldet.',
      maxSubscriptionsPerEmailAndLocation: 3,
      signupRateLimitPerIpPerHour: 10,
      signupRateLimitPerEmailPerHour: 5,
      doiTokenTtlHours: 48,
      pendingSubscriptionTtlHours: 72,
      materializationLookaheadDays: 7,
    };

    expect(
      wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
        ...baseSettingsPayload,
        emailReminderConfig: {
          ...basePayload,
          publicBaseUrl: 'https://example.test',
        },
      }).success
    ).toBe(true);

    expect(
      wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
        ...baseSettingsPayload,
        emailReminderConfig: {
          ...basePayload,
          publicBaseUrl: 'https://example.test',
          fromEmail: 'waste..team@example.test',
        },
      }).success
    ).toBe(false);

    expect(
      wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
        ...baseSettingsPayload,
        emailReminderConfig: {
          ...basePayload,
          publicBaseUrl: 'https://example.test',
          replyToEmail: 'reply@example..test',
        },
      }).success
    ).toBe(false);
  });

  it('rejects absolute success paths in email reminder settings', () => {
    const result = wasteManagementSettingsSchemas.updateWasteSettingsSchema.safeParse({
      ...baseSettingsPayload,
      emailReminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.test',
        doiConfirmPath: '/confirm',
        unsubscribePath: '/unsubscribe',
        signupSuccessPath: 'https://example.test/success',
        fromName: 'Waste Team',
        fromEmail: 'waste@example.test',
        privacyPolicyUrl: 'https://example.test/privacy',
        imprintUrl: 'https://example.test/imprint',
        consentLabel: 'Einverstanden',
        consentVersion: 'v1',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiIntroText: 'Bitte bestaetigen Sie die Anmeldung.',
        doiButtonLabel: 'Bestaetigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Morgen wird abgeholt.',
        unsubscribeLinkLabel: 'Abmelden',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['emailReminderConfig', 'signupSuccessPath'],
        }),
      ])
    );
  });
});
