import type { WasteCollectionLocationRecord } from './master-data-addresses.js';

export type WasteCollectionLocationListStatus = 'all' | 'active' | 'inactive';
export const wasteCollectionLocationSortModes = [
  'address',
  'addressWithRegion',
  'region',
  'city',
  'street',
  'houseNumber',
  'tourCount',
  'status',
] as const;
export type WasteCollectionLocationSortMode = (typeof wasteCollectionLocationSortModes)[number];
export type WasteCollectionLocationSortDirection = 'asc' | 'desc';
export type WasteCollectionLocationPageSize = 10 | 25 | 50 | 100;

export type WasteCollectionLocationQuery = {
  readonly q?: string;
  readonly status: WasteCollectionLocationListStatus;
  readonly regionId?: string;
  readonly cityId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly tourId?: string;
  readonly tourYear?: number;
  readonly tourStatus?: 'draft' | 'published' | 'archived';
  readonly sortMode: WasteCollectionLocationSortMode;
  readonly sortDirection: WasteCollectionLocationSortDirection;
  readonly page: number;
  readonly pageSize: WasteCollectionLocationPageSize;
};

export type WasteCollectionLocationSelectionFilter = Pick<
  WasteCollectionLocationQuery,
  'q' | 'status' | 'regionId' | 'cityId' | 'streetId' | 'houseNumberId' | 'tourId'
>;

export type WasteCollectionLocationTourSummary = {
  readonly id: string;
  readonly name: string;
};

export type WasteCollectionLocationListItem = WasteCollectionLocationRecord & {
  readonly regionName?: string;
  readonly cityName: string;
  readonly streetName?: string;
  readonly houseNumber?: string;
  readonly tours: readonly WasteCollectionLocationTourSummary[];
};

export type WasteCollectionLocationPage = {
  readonly items: readonly WasteCollectionLocationListItem[];
  readonly page: number;
  readonly pageSize: WasteCollectionLocationPageSize;
  readonly total: number;
  readonly pageCount: number;
};
