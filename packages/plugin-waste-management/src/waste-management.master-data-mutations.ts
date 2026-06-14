import { createWasteMasterDataEntityMutations } from './waste-management.master-data.entity-mutations.js';
import { createWasteMasterDataLocationMutations } from './waste-management.master-data.location-mutations.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteMasterDataMutationHandlers = ({
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
}) => ({
  ...createWasteMasterDataEntityMutations({ state, pt, search, loadOverview }),
  ...createWasteMasterDataLocationMutations({ state, pt, search, loadOverview, selectedCollectionLocationIds }),
});
