import {
  createLocationBulkAssignmentsHandler,
  createLocationDeleteHandler,
  createLocationSubmitHandler,
  createLocationsBulkDeleteHandler,
} from './waste-management.master-data.location-mutation.helpers.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteMasterDataLocationMutations = ({
  state,
  pt,
  search,
  loadOverview,
  selectedCollectionLocationIds,
}: {
  state: WasteMasterDataState;
  pt: Translate;
  search: WasteManagementSearchParams;
  loadOverview: (active?: boolean) => Promise<void>;
  selectedCollectionLocationIds: readonly string[];
}) => {
  const context = {
    state,
    pt,
    search,
    loadOverview,
    selectedCollectionLocationIds,
  };

  return {
    onSubmitLocation: createLocationSubmitHandler(context),
    onDeleteLocation: createLocationDeleteHandler(context),
    onDeleteLocations: createLocationsBulkDeleteHandler(context),
    onSubmitBulkAssignments: createLocationBulkAssignmentsHandler(context),
  };
};
