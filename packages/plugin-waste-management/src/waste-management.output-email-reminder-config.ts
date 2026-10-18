import {
  fixedWasteEmailReminderPaths,
  withFixedWasteEmailReminderPaths,
  type WasteManagementEmailReminderConfig,
  type WasteManagementSettingsInterfaceOption,
} from '@sva/waste-management-contracts';

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
  doiSubjectTemplate: 'E-Mail-Erinnerung für {{locationLabel}} bestätigen',
  doiPreheader: 'Ihre Anmeldung beim {{serviceLabel}}',
  doiIntroText:
    'Sie haben eine E-Mail-Erinnerung für {{locationLabel}} angefordert. Bitte bestätigen Sie Ihre Anmeldung über den folgenden Link.',
  doiButtonLabel: 'Anmeldung bestätigen',
  doiFallbackText:
    'Falls Sie diese Anmeldung nicht selbst angefordert haben, können Sie diese E-Mail ignorieren.',
  doiExpiryNoticeText: 'Der Bestätigungslink ist {{expiryHours}} Stunden gültig.',
  doiSuccessHeadline: 'E-Mail-Erinnerung aktiviert',
  doiSuccessBody:
    'Ihre E-Mail-Erinnerung ist aktiv. Sie erhalten künftig Hinweise zu anstehenden Entsorgungsterminen.',
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
