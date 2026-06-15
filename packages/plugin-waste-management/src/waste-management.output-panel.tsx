import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
} from '@sva/plugin-sdk';

import {
  getWasteManagementSettings,
  updateWasteManagementSettings,
} from './waste-management.api.js';
import {
  compactOptionalString,
  resolveApiErrorCode,
  StatusNotice,
  type StatusMessage,
} from './waste-management.page.support.js';
import { useWasteOutputPanelData } from './waste-management.output-panel.data.js';
import { WasteEmailReminderConfigurationSection } from './waste-management.output-email-reminder-card.js';
import { WasteOutputConfigurationSection } from './waste-management.output-panel.parts.js';

const buildDefaultEmailReminderConfig = ({
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
  doiConfirmPath: '/email-reminders/confirm',
  unsubscribePath: '/email-reminders/unsubscribe',
  signupSuccessPath: '/email-reminders/pending',
  activationSuccessPath: '/email-reminders/active',
  unsubscribeSuccessPath: '/email-reminders/unsubscribed',
  invalidTokenPath: '/email-reminders/token-invalid',
  fromName: 'Abfallwirtschaft',
  fromEmail: 'abfall@example.org',
  replyToEmail: 'abfall@example.org',
  serviceLabel: 'Muelli',
  privacyPolicyUrl: 'https://example.org/datenschutz',
  imprintUrl: 'https://example.org/impressum',
  consentLabel: 'Ich stimme der Verarbeitung meiner Daten zur Einrichtung der E-Mail-Erinnerung zu.',
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
  doiSuccessBody: 'Der Dienst ist jetzt aktiv und informiert Sie kuenftig ueber anstehende Entsorgungstermine.',
  doiErrorHeadline: 'Aktivierung nicht moeglich',
  doiErrorBody: 'Der Aktivierungslink ist ungueltig oder bereits abgelaufen.',
  reminderSubjectTemplate: 'Abfalltermin fuer {{locationLabel}} am {{pickupDate}}',
  reminderIntroTemplate: 'Nicht vergessen: {{fractionName}} wird am {{pickupDate}} abgeholt.',
  reminderListIntroTemplate: 'Folgende Abfallart steht als naechstes an:',
  reminderOutroText: 'Sie koennen diese Erinnerung jederzeit wieder abbestellen.',
  unsubscribeLinkLabel: 'E-Mail-Erinnerung abbestellen',
  reminderReasonText: 'Sie erhalten diese Nachricht, weil Sie fuer {{locationLabel}} eine E-Mail-Erinnerung eingerichtet haben.',
  unsubscribeSuccessHeadline: 'E-Mail-Erinnerung deaktiviert',
  unsubscribeSuccessBody: 'Der Dienst wurde fuer diese Adresse erfolgreich deaktiviert.',
  unsubscribeAlreadyDoneHeadline: 'E-Mail-Erinnerung bereits deaktiviert',
  unsubscribeAlreadyDoneBody: 'Fuer diese Adresse ist bereits keine aktive Erinnerung mehr hinterlegt.',
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

const ensureTransportSelection = (
  config: WasteManagementEmailReminderConfig,
  transportOptions: readonly WasteManagementSettingsInterfaceOption[]
): WasteManagementEmailReminderConfig =>
  config.transportId || transportOptions.length === 0
    ? config
    : {
        ...config,
        transportId: transportOptions[0]!.id,
      };

export const WasteOutputPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const { error, loading, settings, setSettings } = useWasteOutputPanelData({
    loadForbiddenMessage: pt('output.pdf.messages.loadForbidden'),
    loadErrorMessage: pt('output.pdf.messages.loadError'),
  });
  const [running, setRunning] = useState(false);
  const [emailRunning, setEmailRunning] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [emailMessage, setEmailMessage] = useState<StatusMessage | null>(null);
  const [brandingAssetUrl, setBrandingAssetUrl] = useState('');
  const [contactBlock, setContactBlock] = useState('');
  const [emailReminderConfig, setEmailReminderConfig] = useState<WasteManagementEmailReminderConfig | null>(null);

  const mailTransportOptions = (settings?.availableInterfaces ?? []).filter(
    (option) => option.typeKey === 'mail_transport'
  );

  useEffect(() => {
    const nextMailTransportOptions = (settings?.availableInterfaces ?? []).filter(
      (option) => option.typeKey === 'mail_transport'
    );
    setBrandingAssetUrl(settings?.pdfBrandingAssetUrl ?? '');
    setContactBlock(settings?.pdfContactBlock ?? '');
    const baseConfig =
      settings?.emailReminderConfig ??
      buildDefaultEmailReminderConfig({
        calendarWebUrl: settings?.calendarWebUrl,
        transportOptions: nextMailTransportOptions,
      });
    setEmailReminderConfig(ensureTransportSelection(baseConfig, nextMailTransportOptions));
  }, [
    settings?.availableInterfaces,
    settings?.calendarWebUrl,
    settings?.emailReminderConfig,
    settings?.pdfBrandingAssetUrl,
    settings?.pdfContactBlock,
  ]);

  if (loading) {
    return <StudioLoadingState>{pt('output.pdf.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setRunning(true);
    setMessage(null);

    try {
      const nextMailTransportOptions = (settings.availableInterfaces ?? []).filter(
        (option) => option.typeKey === 'mail_transport'
      );
      const result = await updateWasteManagementSettings({
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName,
        enabled: settings.enabled,
        selectedInterfaceId: settings.selectedInterfaceId,
        calendarWebUrl: settings.calendarWebUrl,
        pdfBrandingAssetUrl: compactOptionalString(brandingAssetUrl),
        pdfContactBlock: compactOptionalString(contactBlock),
        emailReminderConfig: settings.emailReminderConfig ?? undefined,
        holidayStateCode: settings.holidayStateCode,
        customRecurrencePresets: settings.customRecurrencePresets ?? [],
        deletedPresetFallbacks: {},
      });
      const nextSettings = result ?? (await getWasteManagementSettings());
      setSettings(nextSettings);
      setBrandingAssetUrl(nextSettings?.pdfBrandingAssetUrl ?? '');
      setContactBlock(nextSettings?.pdfContactBlock ?? '');
      setMessage({ kind: 'success', text: pt('output.pdf.messages.saveSuccess') });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('output.pdf.messages.saveForbidden') : pt('output.pdf.messages.saveError'),
      });
    } finally {
      setRunning(false);
    }
  };

  const onEmailReminderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || !emailReminderConfig) {
      return;
    }

    setEmailRunning(true);
    setEmailMessage(null);

    try {
      const nextMailTransportOptions = (settings.availableInterfaces ?? []).filter(
        (option) => option.typeKey === 'mail_transport'
      );
      const result = await updateWasteManagementSettings({
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName,
        enabled: settings.enabled,
        selectedInterfaceId: settings.selectedInterfaceId,
        calendarWebUrl: settings.calendarWebUrl,
        pdfBrandingAssetUrl: compactOptionalString(brandingAssetUrl),
        pdfContactBlock: compactOptionalString(contactBlock),
        emailReminderConfig: ensureTransportSelection(emailReminderConfig, nextMailTransportOptions),
        holidayStateCode: settings.holidayStateCode,
        customRecurrencePresets: settings.customRecurrencePresets ?? [],
        deletedPresetFallbacks: {},
      });
      const nextSettings = result ?? (await getWasteManagementSettings());
      setSettings(nextSettings);
      setEmailReminderConfig(
        ensureTransportSelection(
          nextSettings?.emailReminderConfig ??
            buildDefaultEmailReminderConfig({
              calendarWebUrl: nextSettings?.calendarWebUrl,
              transportOptions: (nextSettings?.availableInterfaces ?? []).filter(
                (option) => option.typeKey === 'mail_transport'
              ),
            }),
          (nextSettings?.availableInterfaces ?? []).filter(
            (option) => option.typeKey === 'mail_transport'
          )
        )
      );
      setEmailMessage({ kind: 'success', text: pt('output.emailReminder.messages.saveSuccess') });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setEmailMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('output.emailReminder.messages.saveForbidden')
            : pt('output.emailReminder.messages.saveError'),
      });
    } finally {
      setEmailRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <StatusNotice message={message} />
      <StatusNotice message={emailMessage} />
      <WasteOutputConfigurationSection
        brandingAssetUrl={brandingAssetUrl}
        contactBlock={contactBlock}
        onSubmit={onSubmit}
        running={running}
        setBrandingAssetUrl={setBrandingAssetUrl}
        setContactBlock={setContactBlock}
        translate={pt}
      />
      {emailReminderConfig ? (
        <WasteEmailReminderConfigurationSection
          hasMailTransportOptions={mailTransportOptions.length > 0}
          onChange={setEmailReminderConfig}
          onSubmit={onEmailReminderSubmit}
          running={emailRunning}
          transportOptions={mailTransportOptions}
          translate={pt}
          value={emailReminderConfig}
        />
      ) : null}
    </div>
  );
};
