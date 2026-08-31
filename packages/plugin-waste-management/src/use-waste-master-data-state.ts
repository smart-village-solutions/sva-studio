import type { StudioJobResponse, WasteCollectionLocationPage } from '@sva/plugin-sdk';
import { startTransition, useState } from 'react';

import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import { useWasteMasterDataEntityState } from './waste-management.master-data.entity-state.js';
import { useWasteMasterDataLocationState } from './waste-management.master-data.location-state.js';

export type WasteLocationCoverageFractionsStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useWasteMasterDataState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [locationCoverageFractions, setLocationCoverageFractions] = useState<
    WasteManagementMasterDataOverview['fractions']
  >([]);
  const [locationCoverageFractionsStatus, setLocationCoverageFractionsStatus] =
    useState<WasteLocationCoverageFractionsStatus>('idle');
  const [collectionLocationPage, setCollectionLocationPage] =
    useState<WasteCollectionLocationPage | null>(null);
  const [filteredLocationIds, setFilteredLocationIds] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [collectionLocationListError, setCollectionLocationListError] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [trackedSyncWasteTypesJob, setTrackedSyncWasteTypesJob] = useState<
    StudioJobResponse['data'] | null
  >(null);
  const [lastOutcome, setLastOutcome] = useState<
    | 'fraction-create-success'
    | 'fraction-update-success'
    | 'location-create-success'
    | 'location-update-success'
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const entityState = useWasteMasterDataEntityState();
  const locationState = useWasteMasterDataLocationState();

  return {
    loading,
    overview,
    locationCoverageFractions,
    locationCoverageFractionsStatus,
    collectionLocationPage,
    filteredLocationIds,
    error: error ?? overviewError ?? collectionLocationListError,
    message,
    trackedSyncWasteTypesJob,
    lastOutcome,
    saving,
    ...entityState,
    ...locationState,
    setLoading,
    setOverview,
    setLocationCoverageFractions,
    setLocationCoverageFractionsStatus,
    setCollectionLocationPage,
    setFilteredLocationIds,
    setError,
    setOverviewError,
    setCollectionLocationListError,
    setMessage,
    setTrackedSyncWasteTypesJob,
    setLastOutcome,
    setSaving,
  };
};

export type WasteMasterDataState = ReturnType<typeof useWasteMasterDataState>;

export const applySuccess = (
  closeDialog: () => void,
  setMessage: (message: StatusMessage | null) => void,
  text: string,
  onSuccess?: () => void,
  showMessage = true
) => {
  startTransition(() => {
    closeDialog();
    onSuccess?.();
    if (showMessage) {
      setMessage({ kind: 'success', text });
    }
  });
};
