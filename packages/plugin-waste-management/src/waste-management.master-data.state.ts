import { type StatusMessage } from './waste-management.page.support.js';
import { startTransition, useState } from 'react';
import type { WasteManagementMasterDataOverview, WasteManagementOutputOverview } from './waste-management.api.js';
import { useWasteMasterDataEntityState } from './waste-management.master-data.entity-state.js';
import { useWasteMasterDataLocationState } from './waste-management.master-data.location-state.js';

export const useWasteMasterDataState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [outputOverview, setOutputOverview] = useState<WasteManagementOutputOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [lastOutcome, setLastOutcome] = useState<
    'fraction-create-success' | 'fraction-update-success' | 'location-create-success' | 'location-update-success' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const entityState = useWasteMasterDataEntityState();
  const locationState = useWasteMasterDataLocationState();

  return {
    loading,
    overview,
    outputOverview,
    error,
    message,
    lastOutcome,
    saving,
    ...entityState,
    ...locationState,
    setLoading,
    setOverview,
    setOutputOverview,
    setError,
    setMessage,
    setLastOutcome,
    setSaving,
  };
};

export type WasteMasterDataState = ReturnType<typeof useWasteMasterDataState>;

export const applySuccess = (
  closeDialog: () => void,
  setMessage: (message: StatusMessage | null) => void,
  text: string,
  onSuccess?: () => void
) => {
  startTransition(() => {
    closeDialog();
    onSuccess?.();
    setMessage({ kind: 'success', text });
  });
};
