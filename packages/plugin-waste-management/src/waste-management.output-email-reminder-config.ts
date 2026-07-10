import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
} from '@sva/plugin-sdk';

import {
  fixedWasteEmailReminderPaths,
  withFixedWasteEmailReminderPaths,
} from './waste-management.email-reminder-paths.js';

export const getMailTransportOptions = (
  options: readonly WasteManagementSettingsInterfaceOption[]
): readonly WasteManagementSettingsInterfaceOption[] =>
  options.filter((option) => option.typeKey === 'mail_transport');

export const buildDefaultEmailReminderConfig = ({
  calendarWebUrl,
  transportOptions,
}: {
  readonly calendarWebUrl?: string;
  readonly transportOptions: readonly WasteManagementSettingsInterfaceOption[];
}): WasteManagementEmailReminderConfig => ({
  enabled: false,
  publicSignupEnabled: false,
  transportId: transportOptions[0]?.id ?? '',
  publicBaseUrl: calendarWebUrl ?? 'https://demo.abfallkalender.example',
  ...fixedWasteEmailReminderPaths,
  fromName: 'Abfallwirtschaft',
  fromEmail: 'abfall@example.org',
  replyToEmail: 'abfall@example.org',
  serviceLabel: 'Muelli',
  privacyPolicyUrl: 'https://example.org/datenschutz',
  imprintUrl: 'https://example.org/impressum',
  consentLabel:
    'Ich stimme der Verarbeitung meiner Daten zur Einrichtung der E-Mail-Erinnerung zu.',
  consentVersion: 'v1',
  dataControllerLabel: 'Abfallwirtschaft',
  dataProtectionContactEmail: 'datenschutz@example.org',
  doiSubjectTemplate: 'Bitte bestaetigen Sie Ihre E-Mail-Erinnerung fuer {{locationLabel}}',
  doiPreheader: 'Bestaetigen Sie die Einrichtung Ihres Erinnerungsdienstes.',
  doiIntroText:
    'Bitte bestaetigen Sie die Einrichtung Ihrer E-Mail-Erinnerung fuer {{locationLabel}} ueber den folgenden Link.',
  doiButtonLabel: 'E-Mail-Erinnerung aktivieren',
  doiFallbackText: 'Falls der Button nicht funktioniert, nutzen Sie bitte den direkten Link.',
  doiExpiryNoticeText: 'Der Aktivierungslink ist zeitlich begrenzt gueltig.',
  doiSuccessHeadline: 'E-Mail-Erinnerung aktiviert',
  doiSuccessBody:
    'Der Dienst ist jetzt aktiv und informiert Sie kuenftig ueber anstehende Entsorgungstermine.',
  doiErrorHeadline: 'Aktivierung nicht moeglich',
  doiErrorBody: 'Der Aktivierungslink ist ungueltig oder bereits abgelaufen.',
  reminderSubjectTemplate: 'Abfalltermin fuer {{locationLabel}} am {{pickupDate}}',
  reminderIntroTemplate: 'Nicht vergessen: {{fractionName}} wird am {{pickupDate}} abgeholt.',
  reminderListIntroTemplate: 'Folgende Abfallart steht als naechstes an:',
  reminderOutroText: 'Sie koennen diese Erinnerung jederzeit wieder abbestellen.',
  unsubscribeLinkLabel: 'E-Mail-Erinnerung abbestellen',
  reminderReasonText:
    'Sie erhalten diese Nachricht, weil Sie fuer {{locationLabel}} eine E-Mail-Erinnerung eingerichtet haben.',
  unsubscribeSuccessHeadline: 'E-Mail-Erinnerung deaktiviert',
  unsubscribeSuccessBody: 'Der Dienst wurde fuer diese Adresse erfolgreich deaktiviert.',
  unsubscribeAlreadyDoneHeadline: 'E-Mail-Erinnerung bereits deaktiviert',
  unsubscribeAlreadyDoneBody:
    'Fuer diese Adresse ist bereits keine aktive Erinnerung mehr hinterlegt.',
  unsubscribeErrorHeadline: 'Abmeldung nicht moeglich',
  unsubscribeErrorBody: 'Der Abmeldelink ist ungueltig oder bereits abgelaufen.',
  maxSubscriptionsPerEmailAndLocation: 5,
  signupRateLimitPerIpPerHour: 20,
  signupRateLimitPerEmailPerHour: 10,
  doiTokenTtlHours: 48,
  pendingSubscriptionTtlHours: 72,
  materializationLookaheadDays: 7,
  unsubscribeTokenTtlDays: 30,
});

export const ensureTransportSelection = (
  config: WasteManagementEmailReminderConfig,
  transportOptions: readonly WasteManagementSettingsInterfaceOption[]
): WasteManagementEmailReminderConfig => {
  const firstTransport = transportOptions[0];
  return config.transportId || !firstTransport
    ? config
    : { ...config, transportId: firstTransport.id };
};

export const normalizeEmailReminderConfig = ({
  config,
  calendarWebUrl,
  transportOptions,
}: {
  readonly config?: WasteManagementEmailReminderConfig | null;
  readonly calendarWebUrl?: string;
  readonly transportOptions: readonly WasteManagementSettingsInterfaceOption[];
}): WasteManagementEmailReminderConfig =>
  withFixedWasteEmailReminderPaths(
    ensureTransportSelection(
      config ?? buildDefaultEmailReminderConfig({ calendarWebUrl, transportOptions }),
      transportOptions
    )
  );
