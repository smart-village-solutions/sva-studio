import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePluginTranslation, wasteManagementMasterDataContract } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioLoadingState,
} from '@sva/studio-ui-react';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import {
  getWasteManagementSettings,
  startWasteManagementHolidaySync,
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
import { WasteSettingsStatusPanel } from './waste-management.settings-status-panel.js';
import type { CustomRecurrencePresetInputState, SettingsFormState } from './waste-management.settings-form.js';

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'supabase',
  projectUrl: '',
  schemaName: 'public',
  enabled: false,
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
        if (!active) return;
        setSettings(response);
        setForm(mapSettingsToForm(response));
        setError(null);
      } catch (loadError) {
        if (!active) return;
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden'
            ? ptRef.current('settings.messages.loadForbidden')
            : ptRef.current('settings.messages.loadError')
        );
      } finally {
        if (active) setLoading(false);
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

const runWasteHolidaySync = async (
  pt: ReturnType<typeof usePluginTranslation>
): Promise<{ readonly message: StatusMessage; readonly settings: WasteManagementSettingsRecord | null }> => {
  try {
    const response = await startWasteManagementHolidaySync();
    return {
      settings: response,
      message: {
        kind: 'success',
        text: pt('settings.messages.holidaySyncSuccess', { status: response?.lastHolidaySyncStatus ?? 'success' }),
      },
    };
  } catch (syncError) {
    const code = resolveApiErrorCode(syncError);
    const error = new Error(
      code === 'forbidden' ? pt('settings.messages.holidaySyncForbidden') : pt('settings.messages.holidaySyncError')
    );
    (error as Error & { cause?: unknown }).cause = syncError;
    throw error;
  }
};

export const WasteSettingsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const { error, form, loading, setForm, setSettings, settings } = useWasteSettingsState(pt);

  if (loading) {
    return <StudioLoadingState>{pt('settings.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await persistWasteSettings(form, pt);
      startTransition(() => {
        setSettings(result.settings);
        setForm(mapSettingsToForm(result.settings));
        setMessage(result.message);
      });
    } catch (saveError) {
      setMessage({ kind: 'error', text: saveError instanceof Error ? saveError.message : pt('settings.messages.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const onRunHolidaySync = async () => {
    if (!settings?.holidayStateCode) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await runWasteHolidaySync(pt);
      const nextSettings = result.settings ?? settings;
      startTransition(() => {
        setSettings(nextSettings);
        setForm(mapSettingsToForm(nextSettings));
        setMessage(result.message);
      });
    } catch (syncError) {
      setMessage({
        kind: 'error',
        text: syncError instanceof Error ? syncError.message : pt('settings.messages.holidaySyncError'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteSettingsStatusPanel settings={settings} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={saving || !settings?.holidayStateCode} onClick={() => void onRunHolidaySync()}>
          {saving ? pt('settings.actions.runningHolidaySync') : pt('settings.actions.runHolidaySync')}
        </Button>
      </div>
      <WasteSettingsForm form={form} saving={saving} onSubmit={onSubmit} onChange={setForm} />
    </div>
  );
};
