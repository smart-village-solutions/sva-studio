import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsRecord,
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
import {
  getMailTransportOptions,
  normalizeEmailReminderConfig,
} from './waste-management.output-email-reminder-config.js';
import { WasteOutputConfigurationSection } from './waste-management.output-panel.parts.js';

const persistEmailReminderSettings = async ({
  settings,
  emailReminderConfig,
  brandingAssetUrl,
  contactBlock,
}: {
  readonly settings: WasteManagementSettingsRecord;
  readonly emailReminderConfig: WasteManagementEmailReminderConfig;
  readonly brandingAssetUrl: string;
  readonly contactBlock: string;
}): Promise<WasteManagementSettingsRecord | null> => {
  const result = await updateWasteManagementSettings({
    provider: settings.provider,
    projectUrl: settings.projectUrl,
    schemaName: settings.schemaName,
    enabled: settings.enabled,
    selectedInterfaceId: settings.selectedInterfaceId,
    calendarWebUrl: settings.calendarWebUrl,
    pdfBrandingAssetUrl: compactOptionalString(brandingAssetUrl),
    pdfContactBlock: compactOptionalString(contactBlock),
    emailReminderConfig: normalizeEmailReminderConfig({
      config: emailReminderConfig,
      calendarWebUrl: settings.calendarWebUrl,
      transportOptions: getMailTransportOptions(settings.availableInterfaces ?? []),
    }),
    holidayStateCode: settings.holidayStateCode,
    customRecurrencePresets: settings.customRecurrencePresets ?? [],
    deletedPresetFallbacks: {},
  });
  return result ?? getWasteManagementSettings();
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
  const [emailReminderConfig, setEmailReminderConfig] =
    useState<WasteManagementEmailReminderConfig | null>(null);

  const mailTransportOptions = getMailTransportOptions(settings?.availableInterfaces ?? []);

  useEffect(() => {
    const nextMailTransportOptions = getMailTransportOptions(settings?.availableInterfaces ?? []);
    setBrandingAssetUrl(settings?.pdfBrandingAssetUrl ?? '');
    setContactBlock(settings?.pdfContactBlock ?? '');
    setEmailReminderConfig(
      normalizeEmailReminderConfig({
        config: settings?.emailReminderConfig,
        calendarWebUrl: settings?.calendarWebUrl,
        transportOptions: nextMailTransportOptions,
      })
    );
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
        text:
          code === 'forbidden'
            ? pt('output.pdf.messages.saveForbidden')
            : pt('output.pdf.messages.saveError'),
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
      const nextSettings = await persistEmailReminderSettings({
        settings,
        emailReminderConfig,
        brandingAssetUrl,
        contactBlock,
      });
      setSettings(nextSettings);
      setEmailReminderConfig(
        normalizeEmailReminderConfig({
          config: nextSettings?.emailReminderConfig,
          calendarWebUrl: nextSettings?.calendarWebUrl,
          transportOptions: getMailTransportOptions(nextSettings?.availableInterfaces ?? []),
        })
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
