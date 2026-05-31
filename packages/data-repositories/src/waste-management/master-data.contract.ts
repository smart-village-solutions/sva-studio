import type {
  WasteCollectionLocationListFilter,
  WasteCollectionLocationRecord,
  WasteCityListFilter,
  WasteCityRecord,
  WasteCustomRecurrencePresetRecord,
  WasteFractionListFilter,
  WasteFractionRecord,
  WasteGlobalDateShiftListFilter,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleListFilter,
  WasteHolidayRuleRecord,
  WasteHouseNumberListFilter,
  WasteHouseNumberRecord,
  WasteLocationTourPickupDateListFilter,
  WasteLocationTourPickupDateRecord,
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

const defineRepositoryMethod = <T extends (...args: any[]) => Promise<unknown>>() => undefined as unknown as T;

export const wasteMasterDataRepositoryContract = {
  listWasteFractions: defineRepositoryMethod<
    (filter?: WasteFractionListFilter) => Promise<readonly WasteFractionRecord[]>
  >(),
  getWasteFractionById: defineRepositoryMethod<(id: string) => Promise<WasteFractionRecord | null>>(),
  upsertWasteFraction: defineRepositoryMethod<
    (input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteFraction: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteRegions: defineRepositoryMethod<(filter?: WasteRegionListFilter) => Promise<readonly WasteRegionRecord[]>>(),
  getWasteRegionById: defineRepositoryMethod<(id: string) => Promise<WasteRegionRecord | null>>(),
  upsertWasteRegion: defineRepositoryMethod<
    (input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  listWasteCities: defineRepositoryMethod<(filter?: WasteCityListFilter) => Promise<readonly WasteCityRecord[]>>(),
  getWasteCityById: defineRepositoryMethod<(id: string) => Promise<WasteCityRecord | null>>(),
  upsertWasteCity: defineRepositoryMethod<(input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>) => Promise<void>>(),
  listWasteStreets: defineRepositoryMethod<(filter?: WasteStreetListFilter) => Promise<readonly WasteStreetRecord[]>>(),
  getWasteStreetById: defineRepositoryMethod<(id: string) => Promise<WasteStreetRecord | null>>(),
  upsertWasteStreet: defineRepositoryMethod<
    (input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  listWasteHouseNumbers: defineRepositoryMethod<
    (filter?: WasteHouseNumberListFilter) => Promise<readonly WasteHouseNumberRecord[]>
  >(),
  getWasteHouseNumberById: defineRepositoryMethod<(id: string) => Promise<WasteHouseNumberRecord | null>>(),
  upsertWasteHouseNumber: defineRepositoryMethod<
    (input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  listWasteCollectionLocations: defineRepositoryMethod<
    (filter?: WasteCollectionLocationListFilter) => Promise<readonly WasteCollectionLocationRecord[]>
  >(),
  getWasteCollectionLocationById: defineRepositoryMethod<
    (id: string) => Promise<WasteCollectionLocationRecord | null>
  >(),
  upsertWasteCollectionLocation: defineRepositoryMethod<
    (input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteCollectionLocation: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteHolidayRules: defineRepositoryMethod<
    (filter?: WasteHolidayRuleListFilter) => Promise<readonly WasteHolidayRuleRecord[]>
  >(),
  upsertWasteHolidayRule: defineRepositoryMethod<
    (input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  listWasteCustomRecurrencePresets: defineRepositoryMethod<
    () => Promise<readonly WasteCustomRecurrencePresetRecord[]>
  >(),
  getWasteCustomRecurrencePresetById: defineRepositoryMethod<
    (id: string) => Promise<WasteCustomRecurrencePresetRecord | null>
  >(),
  upsertWasteCustomRecurrencePreset: defineRepositoryMethod<
    (input: Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteCustomRecurrencePreset: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteTours: defineRepositoryMethod<(filter?: WasteTourListFilter) => Promise<readonly WasteTourRecord[]>>(),
  getWasteTourById: defineRepositoryMethod<(id: string) => Promise<WasteTourRecord | null>>(),
  upsertWasteTour: defineRepositoryMethod<(input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) => Promise<void>>(),
  deleteWasteTour: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteLocationTourLinks: defineRepositoryMethod<
    (filter?: WasteLocationTourLinkListFilter) => Promise<readonly WasteLocationTourLinkRecord[]>
  >(),
  listWasteLocationTourLinksByTourId: defineRepositoryMethod<
    (tourId: string) => Promise<readonly WasteLocationTourLinkRecord[]>
  >(),
  getWasteLocationTourLinkById: defineRepositoryMethod<(id: string) => Promise<WasteLocationTourLinkRecord | null>>(),
  upsertWasteLocationTourLink: defineRepositoryMethod<
    (input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteLocationTourLink: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteLocationTourPickupDates: defineRepositoryMethod<
    (filter?: WasteLocationTourPickupDateListFilter) => Promise<readonly WasteLocationTourPickupDateRecord[]>
  >(),
  getWasteLocationTourPickupDateById: defineRepositoryMethod<
    (id: string) => Promise<WasteLocationTourPickupDateRecord | null>
  >(),
  upsertWasteLocationTourPickupDate: defineRepositoryMethod<
    (input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  listWasteTourDateShifts: defineRepositoryMethod<
    (filter?: WasteTourDateShiftListFilter) => Promise<readonly WasteTourDateShiftRecord[]>
  >(),
  listWasteTourDateShiftsByTourId: defineRepositoryMethod<
    (tourId: string) => Promise<readonly WasteTourDateShiftRecord[]>
  >(),
  getWasteTourDateShiftById: defineRepositoryMethod<(id: string) => Promise<WasteTourDateShiftRecord | null>>(),
  upsertWasteTourDateShift: defineRepositoryMethod<
    (input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteTourDateShift: defineRepositoryMethod<(id: string) => Promise<void>>(),
  listWasteGlobalDateShifts: defineRepositoryMethod<
    (filter?: WasteGlobalDateShiftListFilter) => Promise<readonly WasteGlobalDateShiftRecord[]>
  >(),
  getWasteGlobalDateShiftById: defineRepositoryMethod<(id: string) => Promise<WasteGlobalDateShiftRecord | null>>(),
  upsertWasteGlobalDateShift: defineRepositoryMethod<
    (input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>) => Promise<void>
  >(),
  deleteWasteGlobalDateShift: defineRepositoryMethod<(id: string) => Promise<void>>(),
} as const;

export type WasteMasterDataRepository = typeof wasteMasterDataRepositoryContract;
