import { useCallback, useEffect, useRef, useState } from 'react';
import type { WasteManagementSettingsRecord } from '@sva/waste-management-contracts';

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
  const requestVersion = useRef(0);

  const applySavedSettings = useCallback((value: WasteManagementSettingsRecord | null) => {
    requestVersion.current += 1;
    setSettings(value);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    const isCurrent = () => active && version === requestVersion.current;

    void (async () => {
      try {
        const nextSettings = await getWasteManagementSettings();
        if (!isCurrent()) {
          return;
        }
        setSettings(nextSettings);
        setError(null);
      } catch (loadError) {
        if (!isCurrent()) {
          return;
        }
        const errorKey =
          resolveApiErrorCode(loadError) === 'forbidden' ? loadForbiddenMessage : loadErrorMessage;
        setError(errorKey);
      } finally {
        if (isCurrent()) {
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
    setSettings: applySavedSettings,
  };
};
