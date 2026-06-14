import { createWasteMasterDataDialogActions, createWasteMasterDataSelectionActions } from './waste-management.master-data.actions.js';
import {
  createWasteMasterDataDerivedState,
  createWasteMasterDataResetActions,
} from './waste-management.master-data.derived.js';
import { startWasteManagementSyncWasteTypes } from './waste-management.api.js';
import { useWasteMasterDataOverview } from './use-waste-master-data-overview.js';
import { createWasteMasterDataMutationHandlers } from './waste-management.master-data-mutations.js';
import { useWasteTrackedJob } from './waste-management.tools.job-state.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataState } from './use-waste-master-data-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const noopRefreshTechnicalHistory = async () => undefined;

export const useWasteMasterDataViewModel = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteMasterDataState();
  const loadOverview = useWasteMasterDataOverview(state, pt, search.masterDataTab);
  const derivedState = createWasteMasterDataDerivedState(state, pt, search);
  const dialogActions = createWasteMasterDataDialogActions(state, search);
  const selectionActions = createWasteMasterDataSelectionActions(state, search, derivedState.filteredCollectionLocations);
  const submitHandlers = createWasteMasterDataMutationHandlers({
    state,
    pt,
    search,
    loadOverview,
    selectedCollectionLocationIds: derivedState.selectedCollectionLocations.map((location) => location.id),
  });
  const resetActions = createWasteMasterDataResetActions(state);

  useWasteTrackedJob({
    lastJob: state.trackedSyncWasteTypesJob,
    refreshTechnicalHistory: noopRefreshTechnicalHistory,
    setLastJob: state.setTrackedSyncWasteTypesJob,
    onTerminalJob: async (job) => {
      if (job.status === 'failed' || job.status === 'cancelled') {
        state.setMessage({
          kind: 'warning',
          text: pt('masterData.fractions.messages.syncWarning'),
          retryAction: 'sync-waste-types',
        });
      }
    },
  });

  const retrySyncWasteTypes = async () => {
    state.setMessage(null);
    try {
      const job = await startWasteManagementSyncWasteTypes();
      state.setTrackedSyncWasteTypesJob(job ?? null);
      state.setMessage({
        kind: 'success',
        text: pt('masterData.fractions.messages.syncRetryStarted'),
      });
    } catch {
      state.setTrackedSyncWasteTypesJob(null);
      state.setMessage({
        kind: 'warning',
        text: pt('masterData.fractions.messages.syncWarning'),
        retryAction: 'sync-waste-types',
      });
    }
  };

  return {
    ...state,
    ...derivedState,
    ...dialogActions,
    ...selectionActions,
    ...submitHandlers,
    ...resetActions,
    reloadOverview: loadOverview,
    retrySyncWasteTypes,
  };
};
