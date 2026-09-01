import { useEffect, useRef, useState } from 'react';
import { usePluginTranslation, wasteManagementMasterDataContract } from '@sva/plugin-sdk';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import {
  getWasteManagementSettings,
  updateWasteManagementSettings,
  type WasteManagementSettingsMutationResponse,
  type WasteManagementSettingsInput,
} from './waste-management.api.js';
import { compactOptionalString, resolveApiErrorCode } from './waste-management.page.support.js';
import type {
  CustomRecurrencePresetInputState,
  SettingsFormState,
} from './waste-management.settings-form.js';

type PluginTranslation = ReturnType<typeof usePluginTranslation>;

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'postgresql',
  schemaName: 'public',
  enabled: false,
  selectedInterfaceId: '',
  calendarWebUrl: '',
  pdfBrandingAssetUrl: '',
  pdfContactBlock: '',
  disruptionLocationEnabled: false,
  disruptionAllLocationsEnabled: false,
  holidayStateCode: '',
  customRecurrencePresets: [],
  deletedPresetFallbacks: {},
});

export const mapWasteSettingsToForm = (
  settings: WasteManagementSettingsRecord | null
): SettingsFormState =>
  settings
    ? {
        provider: settings.provider,
        schemaName: settings.schemaName ?? 'public',
        enabled: settings.enabled,
        selectedInterfaceId: settings.selectedInterfaceId ?? '',
        calendarWebUrl: settings.calendarWebUrl ?? '',
        pdfBrandingAssetUrl: settings.pdfBrandingAssetUrl ?? '',
        pdfContactBlock: settings.pdfContactBlock ?? '',
        disruptionLocationEnabled: settings.disruptionLocationEnabled ?? false,
        disruptionAllLocationsEnabled: settings.disruptionAllLocationsEnabled ?? false,
        holidayStateCode: settings.holidayStateCode ?? '',
        customRecurrencePresets: (
          settings.customRecurrencePresets ?? []
        ).map<CustomRecurrencePresetInputState>((preset) => ({
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
  schemaName: compactOptionalString(form.schemaName),
  enabled: form.enabled,
  selectedInterfaceId: compactOptionalString(form.selectedInterfaceId),
  calendarWebUrl: compactOptionalString(form.calendarWebUrl),
  pdfBrandingAssetUrl: compactOptionalString(form.pdfBrandingAssetUrl),
  pdfContactBlock: compactOptionalString(form.pdfContactBlock),
  disruptionLocationEnabled: form.disruptionLocationEnabled,
  disruptionAllLocationsEnabled: form.disruptionAllLocationsEnabled,
  holidayStateCode: wasteManagementMasterDataContract.isWasteHolidayStateCode(form.holidayStateCode)
    ? form.holidayStateCode
    : undefined,
  customRecurrencePresets: form.customRecurrencePresets.map((preset) => ({
    id: preset.id,
    name: preset.name.trim(),
    description: compactOptionalString(preset.description),
    intervalDays: preset.intervalDays,
  })),
  deletedPresetFallbacks: form.deletedPresetFallbacks,
});

export const useWasteSettingsState = (pt: PluginTranslation) => {
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<WasteManagementSettingsRecord | null>(null);
  const [form, setForm] = useState<SettingsFormState>(createDefaultSettingsForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getWasteManagementSettings()
      .then((response) => {
        if (!active) return;
        setSettings(response);
        setForm(mapWasteSettingsToForm(response));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          resolveApiErrorCode(loadError) === 'forbidden'
            ? ptRef.current('settings.messages.loadForbidden')
            : ptRef.current('settings.messages.loadError')
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { error, form, loading, setForm, setSettings, settings };
};

export const persistWasteSettings = async (
  form: SettingsFormState,
  pt: PluginTranslation
): Promise<WasteManagementSettingsMutationResponse> => {
  try {
    return await updateWasteManagementSettings(toSettingsInput(form));
  } catch (saveError) {
    const error = new Error(
      resolveApiErrorCode(saveError) === 'forbidden'
        ? pt('settings.messages.saveForbidden')
        : pt('settings.messages.saveError')
    );
    (error as Error & { cause?: unknown }).cause = saveError;
    throw error;
  }
};
