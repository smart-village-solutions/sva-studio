import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useEffect, useState, type FormEvent } from 'react';

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
import { WasteOutputConfigurationSection } from './waste-management.output-panel.parts.js';

export const WasteOutputPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const { error, loading, settings, setSettings } = useWasteOutputPanelData({
    loadForbiddenMessage: pt('output.pdf.messages.loadForbidden'),
    loadErrorMessage: pt('output.pdf.messages.loadError'),
  });
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [brandingAssetUrl, setBrandingAssetUrl] = useState('');
  const [contactBlock, setContactBlock] = useState('');

  useEffect(() => {
    setBrandingAssetUrl(settings?.pdfBrandingAssetUrl ?? '');
    setContactBlock(settings?.pdfContactBlock ?? '');
  }, [settings?.pdfBrandingAssetUrl, settings?.pdfContactBlock]);

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

  return (
    <div className="space-y-5">
      <StatusNotice message={message} />
      <WasteOutputConfigurationSection
        brandingAssetUrl={brandingAssetUrl}
        contactBlock={contactBlock}
        onSubmit={onSubmit}
        running={running}
        setBrandingAssetUrl={setBrandingAssetUrl}
        setContactBlock={setContactBlock}
        translate={pt}
      />
    </div>
  );
};
