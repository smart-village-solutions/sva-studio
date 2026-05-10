import { startTransition, useEffect, useState, type FormEvent } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  StudioErrorState,
  StudioLoadingState,
} from '@sva/studio-ui-react';
import type { WasteManagementSettingsRecord } from '@sva/core';

import { getWasteManagementSettings, updateWasteManagementSettings, type WasteManagementSettingsInput } from './waste-management.api.js';
import {
  StatusNotice,
  compactOptionalString,
  resolveApiErrorCode,
  type StatusMessage,
} from './waste-management.page.support.js';
import { WasteSettingsForm } from './waste-management.settings-form.js';
import { WasteSettingsStatusPanel } from './waste-management.settings-status-panel.js';

type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
};

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'supabase',
  projectUrl: '',
  schemaName: 'public',
  enabled: false,
  databaseUrl: '',
  serviceRoleKey: '',
});

const mapSettingsToForm = (settings: WasteManagementSettingsRecord | null): SettingsFormState =>
  settings
    ? {
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName ?? 'public',
        enabled: settings.enabled,
        databaseUrl: '',
        serviceRoleKey: '',
      }
    : createDefaultSettingsForm();

const toSettingsInput = (form: SettingsFormState): WasteManagementSettingsInput => ({
  provider: form.provider,
  projectUrl: form.projectUrl.trim(),
  schemaName: compactOptionalString(form.schemaName),
  enabled: form.enabled,
  databaseUrl: compactOptionalString(form.databaseUrl),
  serviceRoleKey: compactOptionalString(form.serviceRoleKey),
});

export const WasteSettingsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WasteManagementSettingsRecord | null>(null);
  const [form, setForm] = useState<SettingsFormState>(createDefaultSettingsForm());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

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
        setError(code === 'forbidden' ? pt('settings.messages.loadForbidden') : pt('settings.messages.loadError'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pt]);

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
      const response = await updateWasteManagementSettings(toSettingsInput(form));
      startTransition(() => {
        setSettings(response);
        setForm(mapSettingsToForm(response));
        setMessage({ kind: 'success', text: pt('settings.messages.saveSuccess') });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('settings.messages.saveForbidden') : pt('settings.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteSettingsStatusPanel settings={settings} />
      <WasteSettingsForm form={form} saving={saving} onSubmit={onSubmit} onChange={setForm} />
    </div>
  );
};
