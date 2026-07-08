import { describe, expect, it } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';

import { loadWasteEmailReminderSettings } from './waste-management-email-reminder-config.server';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const createEmailReminderConfig = (transportId = 'transport-smtp') => ({
  enabled: true,
  publicSignupEnabled: true,
  transportId,
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

const createSupabaseRecord = (
  overrides: Partial<ExternalInterfaceRecord> & {
    emailReminderConfig?: Record<string, unknown> | null;
    unsubscribeSigningSecret?: string;
  } = {},
): ExternalInterfaceRecord => {
  const {
    emailReminderConfig,
    unsubscribeSigningSecret,
    publicConfig: publicConfigOverrides,
    ...recordOverrides
  } = overrides;

  return {
    id: overrides.id ?? 'supabase-1',
    instanceId: 'instance-1',
    typeKey: 'supabase',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: 'Waste Supabase',
    alias: 'default',
    enabled: true,
    isDefault: true,
    category: 'database',
    baseUrl: 'https://tenant.supabase.co',
    authMode: 'service_role',
    publicConfig: {
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      ...(unsubscribeSigningSecret
        ? { emailReminderSigningSecret: unsubscribeSigningSecret }
        : {}),
      ...(emailReminderConfig === null
        ? {}
        : {
            emailReminderConfig:
              emailReminderConfig ?? createEmailReminderConfig(),
          }),
      ...publicConfigOverrides,
    },
    secretConfigCiphertext: 'cipher',
    statusCheckKind: 'supabase',
    visibleStatus: 'ok',
    lastCheckStatus: 'succeeded',
    lastCheckedAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-10T10:00:00.000Z',
    ...recordOverrides,
  };
};

describe('waste email reminder config loader', () => {
  it('prefers the explicitly selected supabase record and returns its signing secret', async () => {
    const deps: WasteOperationRuntimeDeps = {
      listInterfaceRecords: async () => [
        createSupabaseRecord({
          id: 'default-record',
          isDefault: true,
          publicConfig: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'wm',
            emailReminderConfig: {
              enabled: false,
            },
          },
        }),
        createSupabaseRecord({
          id: 'selected-record',
          isDefault: false,
          publicConfig: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'wm-selected',
            wasteManagementSelected: true,
            emailReminderSigningSecret: 'selected-secret',
            emailReminderConfig: createEmailReminderConfig('transport-selected'),
          },
        }),
      ],
    };

    const settings = await loadWasteEmailReminderSettings(deps, 'instance-1');

    expect(settings).toMatchObject({
      unsubscribeSigningSecret: 'selected-secret',
      config: {
        enabled: true,
        transportId: 'transport-selected',
      },
    });
  });

  it('returns null when no selected supabase record exposes a valid reminder config', async () => {
    const deps: WasteOperationRuntimeDeps = {
      listInterfaceRecords: async () => [
        createSupabaseRecord({
          id: 'default-record',
          isDefault: true,
          emailReminderConfig: null,
        }),
      ],
    };

    await expect(loadWasteEmailReminderSettings(deps, 'instance-1')).resolves.toBeNull();
  });

  it('supports the default-interface fallback when no interface list is available', async () => {
    const deps: WasteOperationRuntimeDeps = {
      loadDefaultInterfaceRecord: async (_instanceId, typeKey) =>
        typeKey === 'supabase'
          ? createSupabaseRecord({
              id: 'fallback-record',
              unsubscribeSigningSecret: 'fallback-secret',
            })
          : null,
    };

    const settings = await loadWasteEmailReminderSettings(deps, 'instance-1');

    expect(settings).toMatchObject({
      unsubscribeSigningSecret: 'fallback-secret',
      config: {
        enabled: true,
        transportId: 'transport-smtp',
      },
    });
  });
});
