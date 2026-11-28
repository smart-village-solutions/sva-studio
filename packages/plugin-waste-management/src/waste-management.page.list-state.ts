import {
  normalizeWasteManagementSearchParams,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';

const tabListStateKeys = {
  fractions: ['q', 'fractionsStatus', 'fractionsSortBy', 'fractionsSortDirection'],
  tours: [
    'q',
    'tourStatus',
    'tourValidityPeriod',
    'tourReview',
    'tourWasteFractionId',
    'firstDateFrom',
    'firstDateTo',
    'endDateFrom',
    'endDateTo',
  ],
  locations: [
    'q',
    'status',
    'regionId',
    'cityId',
    'tourId',
    'locationStreetId',
    'locationHouseNumberId',
    'locationYear',
    'locationTourStatus',
    'locationSortMode',
    'locationSortDirection',
  ],
  masterData: [
    'q',
    'addressEntityType',
    'addressParentId',
    'addressSortBy',
    'addressSortDirection',
  ],
  scheduling: ['q', 'shiftContext', 'tourId', 'shiftDateFrom', 'shiftDateTo'],
  tourAssignments: ['tourId'],
  tools: ['q'],
  output: [],
  settings: [],
} as const satisfies Record<WasteManagementTabId, readonly (keyof WasteManagementSearchParams)[]>;

export const captureWasteManagementTabListState = (
  search: WasteManagementSearchParams
): Partial<WasteManagementSearchParams> => ({
  pageSize: search.pageSize,
  ...Object.fromEntries(tabListStateKeys[search.tab].map((key) => [key, search[key]])),
});

export const toWasteManagementTabSearch = (
  tab: WasteManagementTabId,
  listState?: Partial<WasteManagementSearchParams>
): WasteManagementSearchParams => normalizeWasteManagementSearchParams({ ...listState, tab });

export const resetWasteManagementTabListState = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams => ({
  ...search,
  ...captureWasteManagementTabListState(toWasteManagementTabSearch(search.tab)),
  page: 1,
});
