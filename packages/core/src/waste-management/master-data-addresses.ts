import type { WasteFractionReminderConfig } from './master-data-contract.js';
import type { WasteLocalizedTextRecord } from './master-data-localized-text.js';

export type WasteFractionRecord = {
  readonly id: string;
  readonly name: string;
  readonly pdfShortLabel?: string;
  readonly translations?: WasteLocalizedTextRecord;
  readonly containerSize?: string;
  readonly color: string;
  readonly description?: string;
  readonly active: boolean;
  readonly reminderConfig: WasteFractionReminderConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteFractionListFilter = {
  readonly active?: boolean;
  readonly search?: string;
};

export type WasteRegionRecord = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteRegionListFilter = {
  readonly search?: string;
};

export type WasteCityRecord = {
  readonly id: string;
  readonly name: string;
  readonly postalCode?: string;
  readonly regionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteCityListFilter = {
  readonly regionId?: string;
  readonly search?: string;
};

export type WasteStreetRecord = {
  readonly id: string;
  readonly name: string;
  readonly cityId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteStreetListFilter = {
  readonly cityId?: string;
  readonly search?: string;
};

export type WasteHouseNumberRecord = {
  readonly id: string;
  readonly number: string;
  readonly streetId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteHouseNumberListFilter = {
  readonly streetId?: string;
  readonly search?: string;
};

export type WasteCollectionLocationRecord = {
  readonly id: string;
  readonly cityId: string;
  readonly regionId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// fallow-ignore-next-line unused-type
export type WasteCollectionLocationListFilter = {
  readonly cityId?: string;
  readonly regionId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly active?: boolean;
};

export type WasteCollectionLocationListStatus = 'all' | 'active' | 'inactive';
export type WasteCollectionLocationSortMode = 'address' | 'addressWithRegion';
export type WasteCollectionLocationSortDirection = 'asc' | 'desc';
export type WasteCollectionLocationPageSize = 10 | 25 | 50 | 100;

export type WasteCollectionLocationQuery = {
  readonly q?: string;
  readonly status: WasteCollectionLocationListStatus;
  readonly regionId?: string;
  readonly cityId?: string;
  readonly tourId?: string;
  readonly sortMode: WasteCollectionLocationSortMode;
  readonly sortDirection: WasteCollectionLocationSortDirection;
  readonly page: number;
  readonly pageSize: WasteCollectionLocationPageSize;
};

export type WasteCollectionLocationSelectionFilter = Pick<
  WasteCollectionLocationQuery,
  'q' | 'status' | 'regionId' | 'cityId' | 'tourId'
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
