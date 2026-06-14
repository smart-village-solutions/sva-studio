import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

export type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export type WasteMasterDataSubmissionContext = {
  readonly state: WasteMasterDataState;
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly loadOverview: (active?: boolean) => Promise<void>;
};
