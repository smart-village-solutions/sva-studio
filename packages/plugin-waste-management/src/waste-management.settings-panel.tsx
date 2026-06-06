import { startTransition, useEffect, useRef, useState } from 'react';
import { usePluginTranslation, wasteManagementMasterDataContract } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import {
  getWasteManagementSettings,
  updateWasteManagementSettings,
  type WasteManagementSettingsInput,
} from './waste-management.api.js';
import {
  StatusNotice,
  compactOptionalString,
  resolveApiErrorCode,
  type StatusMessage,
} from './waste-management.page.support.js';
import { WasteSettingsForm } from './waste-management.settings-form.js';
import type { CustomRecurrencePresetInputState, SettingsFormState } from './waste-management.settings-form.js';

type SavingSection = 'interface' | 'holiday' | 'calendarWebUrl' | 'customRecurrences' | null;

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'supabase',
  projectUrl: '',
  schemaName: 'public',
  enabled: false,
  selectedInterfaceId: '',
  calendarWebUrl: '',
  pdfBrandingAssetUrl: '',
  pdfContactBlock: '',
  holidayStateCode: '',
  databaseUrl: '',
  serviceRoleKey: '',
  customRecurrencePresets: [],
  deletedPresetFallbacks: {},
});

const mapSettingsToForm = (settings: WasteManagementSettingsRecord | null): SettingsFormState =>
  settings
    ? {
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName ?? 'public',
        enabled: settings.enabled,
        selectedInterfaceId: settings.selectedInterfaceId ?? '',
        calendarWebUrl: settings.calendarWebUrl ?? '',
        pdfBrandingAssetUrl: settings.pdfBrandingAssetUrl ?? '',
        pdfContactBlock: settings.pdfContactBlock ?? '',
        holidayStateCode: settings.holidayStateCode ?? '',
        databaseUrl: '',
        serviceRoleKey: '',
        customRecurrencePresets: (settings.customRecurrencePresets ?? []).map<CustomRecurrencePresetInputState>((preset) => ({
          id: preset.id,
          name: preset.name,
          description: preset.description ?? '',
          intervalDays: preset.intervalDays,
        })),
        deletedPresetFallbacks: {},
      }
    : createDefaultSettingsForm();

const toSettingsInput = (form: SettingsFormState): WasteManagementSettingsInput => ({
  provider: form.provider,
  projectUrl: form.projectUrl.trim(),
  schemaName: compactOptionalString(form.schemaName),
  enabled: form.enabled,
  selectedInterfaceId: compactOptionalString(form.selectedInterfaceId),
  calendarWebUrl: compactOptionalString(form.calendarWebUrl),
  pdfBrandingAssetUrl: compactOptionalString(form.pdfBrandingAssetUrl),
  pdfContactBlock: compactOptionalString(form.pdfContactBlock),
  holidayStateCode: wasteManagementMasterDataContract.isWasteHolidayStateCode(form.holidayStateCode)
    ? form.holidayStateCode
    : undefined,
  databaseUrl: compactOptionalString(form.databaseUrl),
  serviceRoleKey: compactOptionalString(form.serviceRoleKey),
  customRecurrencePresets: form.customRecurrencePresets.map((preset) => ({
    id: preset.id,
    name: preset.name.trim(),
    description: compactOptionalString(preset.description),
    intervalDays: preset.intervalDays,
  })),
  deletedPresetFallbacks: form.deletedPresetFallbacks,
});

const useWasteSettingsState = (pt: ReturnType<typeof usePluginTranslation>) => {
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<WasteManagementSettingsRecord | null>(null);
  const [form, setForm] = useState<SettingsFormState>(createDefaultSettingsForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await getWasteManagementSettings();
        if (!active) {
          return;
        }
        setSettings(response);
        setForm(mapSettingsToForm(response));
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('settings.messages.loadForbidden')
            : ptRef.current('settings.messages.loadError')
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { error, form, loading, setForm, setSettings, settings };
};

const persistWasteSettings = async (
  form: SettingsFormState,
  pt: ReturnType<typeof usePluginTranslation>
): Promise<{ readonly message: StatusMessage; readonly settings: WasteManagementSettingsRecord | null }> => {
  try {
    const response = await updateWasteManagementSettings(toSettingsInput(form));
    const messageText = response?.lastHolidaySyncStatus
      ? pt('settings.messages.saveSuccessWithHolidaySync', { status: response.lastHolidaySyncStatus })
      : pt('settings.messages.saveSuccess');
    return {
      settings: response,
      message: { kind: 'success', text: messageText },
    };
  } catch (saveError) {
    const code = resolveApiErrorCode(saveError);
    const error = new Error(code === 'forbidden' ? pt('settings.messages.saveForbidden') : pt('settings.messages.saveError'));
    (error as Error & { cause?: unknown }).cause = saveError;
    throw error;
  }
};

export const WasteSettingsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const [savingSection, setSavingSection] = useState<SavingSection>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const { error, form, loading, setForm, setSettings, settings } = useWasteSettingsState(pt);

  if (loading) {
    return <StudioLoadingState>{pt('settings.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const applyPersistedSettings = (result: { readonly message: StatusMessage; readonly settings: WasteManagementSettingsRecord | null }) => {
    startTransition(() => {
      setSettings(result.settings);
      setForm(mapSettingsToForm(result.settings));
      setMessage(result.message);
    });
  };

  const saveSection = async (section: Exclude<SavingSection, null>, nextForm: SettingsFormState) => {
    setSavingSection(section);
    setMessage(null);

    try {
      const result = await persistWasteSettings(nextForm, pt);
      applyPersistedSettings(result);
    } catch (saveError) {
      setMessage({ kind: 'error', text: saveError instanceof Error ? saveError.message : pt('settings.messages.saveError') });
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteSettingsForm
        form={form}
        settings={settings}
        savingSection={savingSection}
        onChange={setForm}
        onSaveInterfaceSelection={() => void saveSection('interface', form)}
        onSaveHolidayState={() => void saveSection('holiday', form)}
        onSaveCalendarWebUrl={() => void saveSection('calendarWebUrl', form)}
        onPersistCustomRecurrences={(customRecurrencePresets, deletedPresetFallbacks) => {
          const nextForm = {
            ...form,
            customRecurrencePresets: [...customRecurrencePresets],
            deletedPresetFallbacks,
          };
          setForm(nextForm);
          void saveSection('customRecurrences', nextForm);
        }}
      />
    </div>
  );
};
