import { type StatusMessage } from './waste-management.page.support.js';
import { startTransition, useState } from 'react';
import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import { useWasteMasterDataEntityState } from './waste-management.master-data.entity-state.js';
import { useWasteMasterDataLocationState } from './waste-management.master-data.location-state.js';

export const useWasteMasterDataState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const entityState = useWasteMasterDataEntityState();
  const locationState = useWasteMasterDataLocationState();

  return {
    loading,
    overview,
    error,
    message,
    saving,
    ...entityState,
    ...locationState,
    setLoading,
    setOverview,
    setError,
    setMessage,
    setSaving,
  };
};

export type WasteMasterDataState = ReturnType<typeof useWasteMasterDataState>;

export const applySuccess = (closeDialog: () => void, setMessage: (message: StatusMessage | null) => void, text: string) => {
  startTransition(() => {
    closeDialog();
    setMessage({ kind: 'success', text });
  });
};
