import type {
  WasteFractionReminderConfig,
} from './master-data-contract.js';
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

export type WasteRegionListFilter = {
  readonly search?: string;
};

export type WasteCityRecord = {
  readonly id: string;
  readonly name: string;
  readonly regionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

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

export type WasteCollectionLocationListFilter = {
  readonly cityId?: string;
  readonly regionId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly active?: boolean;
};
