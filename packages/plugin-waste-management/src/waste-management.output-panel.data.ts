import { useEffect, useState } from 'react';
import type { WasteManagementSettingsRecord } from '@sva/plugin-sdk';

import { getWasteManagementSettings } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type WasteOutputPanelDataState = Readonly<{
  loading: boolean;
  error: string | null;
  settings: WasteManagementSettingsRecord | null;
  setSettings: (value: WasteManagementSettingsRecord | null) => void;
}>;

export const useWasteOutputPanelData = ({
  loadForbiddenMessage,
  loadErrorMessage,
}: {
  readonly loadForbiddenMessage: string;
  readonly loadErrorMessage: string;
}): WasteOutputPanelDataState => {
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
            ? loadForbiddenMessage
            : loadErrorMessage;
        setError(errorKey);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadErrorMessage, loadForbiddenMessage]);

  return {
    loading,
    error,
    settings,
    setSettings,
  };
};
