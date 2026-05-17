import { createWasteMasterDataEntitySubmissions } from './waste-management.master-data.entity-submissions.js';
import { createWasteMasterDataLocationSubmissions } from './waste-management.master-data.location-submissions.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteMasterDataSubmitHandlers = ({
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
  ...createWasteMasterDataEntitySubmissions({ state, pt, search, loadOverview }),
  ...createWasteMasterDataLocationSubmissions({ state, pt, search, loadOverview, selectedCollectionLocationIds }),
});
