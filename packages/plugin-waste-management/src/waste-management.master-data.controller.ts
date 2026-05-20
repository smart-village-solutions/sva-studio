import { createWasteMasterDataDialogActions, createWasteMasterDataSelectionActions } from './waste-management.master-data.actions.js';
import {
  createWasteMasterDataDerivedState,
  createWasteMasterDataResetActions,
} from './waste-management.master-data.derived.js';
import { useWasteMasterDataDataLoading } from './waste-management.master-data.loaders.js';
import { createWasteMasterDataSubmitHandlers } from './waste-management.master-data.submissions.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataState } from './waste-management.master-data.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteMasterDataController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteMasterDataState();
  const loadOverview = useWasteMasterDataDataLoading(state, pt, search.masterDataTab);
  const derivedState = createWasteMasterDataDerivedState(state, pt, search);
  const dialogActions = createWasteMasterDataDialogActions(state, search);
  const selectionActions = createWasteMasterDataSelectionActions(state, search, derivedState.filteredCollectionLocations);
  const submitHandlers = createWasteMasterDataSubmitHandlers({
    state,
    pt,
    search,
    loadOverview,
    selectedCollectionLocationIds: derivedState.selectedCollectionLocations.map((location) => location.id),
  });
  const resetActions = createWasteMasterDataResetActions(state);

  return {
    ...state,
    ...derivedState,
    ...dialogActions,
    ...selectionActions,
    ...submitHandlers,
    ...resetActions,
    reloadOverview: loadOverview,
  };
};
