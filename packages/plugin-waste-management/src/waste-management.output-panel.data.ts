import { useEffect, useState } from 'react';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import { getWasteManagementSettings } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type OutputTranslate = (key: string) => string;

type WasteOutputPanelDataState = Readonly<{
  loading: boolean;
  error: string | null;
  settings: WasteManagementSettingsRecord | null;
  setSettings: (value: WasteManagementSettingsRecord | null) => void;
}>;

export const useWasteOutputPanelData = (translate: OutputTranslate): WasteOutputPanelDataState => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<WasteManagementSettingsRecord | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextSettings = await getWasteManagementSettings();
        if (!active) {
          return;
        }
        setSettings(nextSettings);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const errorKey =
          resolveApiErrorCode(loadError) === 'forbidden'
            ? 'output.pdf.messages.loadForbidden'
            : 'output.pdf.messages.loadError';
        setError(translate(errorKey));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [translate]);

  return {
    loading,
    error,
    settings,
    setSettings,
  };
};
