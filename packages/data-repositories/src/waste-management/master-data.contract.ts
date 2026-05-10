import type {
  WasteCollectionLocationListFilter,
  WasteCollectionLocationRecord,
  WasteCityListFilter,
  WasteCityRecord,
  WasteFractionListFilter,
  WasteFractionRecord,
  WasteGlobalDateShiftListFilter,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberListFilter,
  WasteHouseNumberRecord,
  WasteLocationTourLinkListFilter,
  WasteLocationTourLinkRecord,
  WasteRegionListFilter,
  WasteRegionRecord,
  WasteStreetListFilter,
  WasteStreetRecord,
  WasteTourDateShiftListFilter,
  WasteTourDateShiftRecord,
  WasteTourListFilter,
  WasteTourRecord,
} from '@sva/core';

export type WasteMasterDataRepository = {
  listWasteFractions(filter?: WasteFractionListFilter): Promise<readonly WasteFractionRecord[]>;
  getWasteFractionById(id: string): Promise<WasteFractionRecord | null>;
  upsertWasteFraction(input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteRegions(filter?: WasteRegionListFilter): Promise<readonly WasteRegionRecord[]>;
  getWasteRegionById(id: string): Promise<WasteRegionRecord | null>;
  upsertWasteRegion(input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteCities(filter?: WasteCityListFilter): Promise<readonly WasteCityRecord[]>;
  getWasteCityById(id: string): Promise<WasteCityRecord | null>;
  upsertWasteCity(input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteStreets(filter?: WasteStreetListFilter): Promise<readonly WasteStreetRecord[]>;
  getWasteStreetById(id: string): Promise<WasteStreetRecord | null>;
  upsertWasteStreet(input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteHouseNumbers(filter?: WasteHouseNumberListFilter): Promise<readonly WasteHouseNumberRecord[]>;
  getWasteHouseNumberById(id: string): Promise<WasteHouseNumberRecord | null>;
  upsertWasteHouseNumber(input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteCollectionLocations(
    filter?: WasteCollectionLocationListFilter
  ): Promise<readonly WasteCollectionLocationRecord[]>;
  getWasteCollectionLocationById(id: string): Promise<WasteCollectionLocationRecord | null>;
  upsertWasteCollectionLocation(
    input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteTours(filter?: WasteTourListFilter): Promise<readonly WasteTourRecord[]>;
  getWasteTourById(id: string): Promise<WasteTourRecord | null>;
  upsertWasteTour(input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  listWasteLocationTourLinks(
    filter?: WasteLocationTourLinkListFilter
  ): Promise<readonly WasteLocationTourLinkRecord[]>;
  getWasteLocationTourLinkById(id: string): Promise<WasteLocationTourLinkRecord | null>;
  upsertWasteLocationTourLink(
    input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteTourDateShifts(
    filter?: WasteTourDateShiftListFilter
  ): Promise<readonly WasteTourDateShiftRecord[]>;
  getWasteTourDateShiftById(id: string): Promise<WasteTourDateShiftRecord | null>;
  upsertWasteTourDateShift(
    input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
  listWasteGlobalDateShifts(
    filter?: WasteGlobalDateShiftListFilter
  ): Promise<readonly WasteGlobalDateShiftRecord[]>;
  getWasteGlobalDateShiftById(id: string): Promise<WasteGlobalDateShiftRecord | null>;
  upsertWasteGlobalDateShift(
    input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
  ): Promise<void>;
};
