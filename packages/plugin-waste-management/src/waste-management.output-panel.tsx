import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  isPersistableContentMediaUrl,
  StudioErrorState,
  StudioLoadingState,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
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
    schemaName: settings.schemaName,
    enabled: settings.enabled,
    selectedInterfaceId: settings.selectedInterfaceId,
    calendarWebUrl: settings.calendarWebUrl,
    pdfBrandingAssetUrl: compactOptionalString(brandingAssetUrl),
    pdfContactBlock: compactOptionalString(contactBlock),
    disruptionLocationEnabled: settings.disruptionLocationEnabled,
    disruptionAllLocationsEnabled: settings.disruptionAllLocationsEnabled,
    emailReminderConfig: normalizeEmailReminderConfig({
      config: emailReminderConfig,
      calendarWebUrl: settings.calendarWebUrl,
      transportOptions: getMailTransportOptions(settings.availableInterfaces ?? []),
    }),
    holidayStateCode: settings.holidayStateCode,
    customRecurrencePresets: settings.customRecurrencePresets ?? [],
    deletedPresetFallbacks: {},
  });
  return result?.data ?? getWasteManagementSettings();
};

export const WasteOutputPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const { error, loading, settings, setSettings } = useWasteOutputPanelData({
    loadForbiddenMessage: pt('output.pdf.messages.loadForbidden'),
    loadErrorMessage: pt('output.pdf.messages.loadError'),
  });
  const pdfSaveFeedback = useStudioSaveFeedback();
  const emailSaveFeedback = useStudioSaveFeedback();
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [emailMessage, setEmailMessage] = useState<StatusMessage | null>(null);
  const [brandingAssetUrl, setBrandingAssetUrl] = useState('');
  const [brandingAssetUrlError, setBrandingAssetUrlError] = useState<string | undefined>();
  const [contactBlock, setContactBlock] = useState('');
  const [emailReminderConfig, setEmailReminderConfig] =
    useState<WasteManagementEmailReminderConfig | null>(null);

  const mailTransportOptions = getMailTransportOptions(settings?.availableInterfaces ?? []);

  useEffect(() => {
    const nextMailTransportOptions = getMailTransportOptions(settings?.availableInterfaces ?? []);
    setBrandingAssetUrl(settings?.pdfBrandingAssetUrl ?? '');
    setBrandingAssetUrlError(undefined);
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

    const compactBrandingAssetUrl = compactOptionalString(brandingAssetUrl);
    if (compactBrandingAssetUrl && !isPersistableContentMediaUrl(compactBrandingAssetUrl)) {
      setBrandingAssetUrlError(pt('output.pdf.messages.invalidBrandingAssetUrl'));
      return;
    }

    const operationId = pdfSaveFeedback.beginSaving();
    setMessage(null);

    try {
      const result = await updateWasteManagementSettings({
        provider: settings.provider,
        schemaName: settings.schemaName,
        enabled: settings.enabled,
        selectedInterfaceId: settings.selectedInterfaceId,
        calendarWebUrl: settings.calendarWebUrl,
        pdfBrandingAssetUrl: compactBrandingAssetUrl,
        pdfContactBlock: compactOptionalString(contactBlock),
        disruptionLocationEnabled: settings.disruptionLocationEnabled,
        disruptionAllLocationsEnabled: settings.disruptionAllLocationsEnabled,
        emailReminderConfig: settings.emailReminderConfig ?? undefined,
        holidayStateCode: settings.holidayStateCode,
        customRecurrencePresets: settings.customRecurrencePresets ?? [],
        deletedPresetFallbacks: {},
      });
      const nextSettings = result?.data ?? (await getWasteManagementSettings());
      setSettings(nextSettings);
      setBrandingAssetUrl(nextSettings?.pdfBrandingAssetUrl ?? '');
      setContactBlock(nextSettings?.pdfContactBlock ?? '');
      pdfSaveFeedback.markSaved(operationId);
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('output.pdf.messages.saveForbidden')
            : pt('output.pdf.messages.saveError'),
      });
      pdfSaveFeedback.markFailed(operationId);
    }
  };

  const onEmailReminderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || !emailReminderConfig) {
      return;
    }

    const compactBrandingAssetUrl = compactOptionalString(brandingAssetUrl);
    if (compactBrandingAssetUrl && !isPersistableContentMediaUrl(compactBrandingAssetUrl)) {
      setBrandingAssetUrlError(pt('output.pdf.messages.invalidBrandingAssetUrl'));
      return;
    }

    const operationId = emailSaveFeedback.beginSaving();
    setEmailMessage(null);

    try {
      const nextSettings = await persistEmailReminderSettings({
        settings,
        emailReminderConfig,
        brandingAssetUrl: compactBrandingAssetUrl ?? '',
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
      emailSaveFeedback.markSaved(operationId);
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setEmailMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('output.emailReminder.messages.saveForbidden')
            : pt('output.emailReminder.messages.saveError'),
      });
      emailSaveFeedback.markFailed(operationId);
    }
  };

  return (
    <div className="space-y-5">
      <StatusNotice message={message} />
      <StatusNotice message={emailMessage} />
      <WasteOutputConfigurationSection
        brandingAssetUrl={brandingAssetUrl}
        brandingAssetUrlError={brandingAssetUrlError}
        contactBlock={contactBlock}
        onSubmit={onSubmit}
        saveStatus={pdfSaveFeedback.status}
        setBrandingAssetUrl={(value) => {
          pdfSaveFeedback.markDirty();
          setBrandingAssetUrlError(undefined);
          setBrandingAssetUrl(value);
        }}
        setContactBlock={(value) => {
          pdfSaveFeedback.markDirty();
          setContactBlock(value);
        }}
        translate={pt}
      />
      {emailReminderConfig ? (
        <WasteEmailReminderConfigurationSection
          hasMailTransportOptions={mailTransportOptions.length > 0}
          onChange={(value) => {
            emailSaveFeedback.markDirty();
            setEmailReminderConfig(value);
          }}
          onSubmit={onEmailReminderSubmit}
          saveStatus={emailSaveFeedback.status}
          transportOptions={mailTransportOptions}
          translate={pt}
          value={emailReminderConfig}
        />
      ) : null}
    </div>
  );
};
