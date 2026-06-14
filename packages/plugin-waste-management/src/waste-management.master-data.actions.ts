import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';

import { createWasteMasterDataEntityActions } from './waste-management.master-data.entity-actions.js';
import { createWasteMasterDataLocationActions } from './waste-management.master-data.location-actions.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const createWasteMasterDataDialogActions = (
  state: WasteMasterDataState,
  search: WasteManagementSearchParams
) => createWasteMasterDataEntityActions(state, search);

export const createWasteMasterDataSelectionActions = (
  state: WasteMasterDataState,
  search: WasteManagementSearchParams,
  filteredCollectionLocations: readonly WasteCollectionLocationRecord[]
) => createWasteMasterDataLocationActions(state, search, filteredCollectionLocations);
