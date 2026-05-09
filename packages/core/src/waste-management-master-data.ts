export type WasteFractionRecord = {
  readonly id: string;
  readonly name: string;
  readonly containerSize?: string;
  readonly color: string;
  readonly description?: string;
  readonly active: boolean;
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

export type WasteTourRecurrence = 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom';

export type WasteCustomTourDate = {
  readonly date: string;
  readonly description?: string;
};

export type WasteTourRecord = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence?: WasteTourRecurrence | null;
  readonly firstDate?: string;
  readonly endDate?: string;
  readonly customDates?: readonly WasteCustomTourDate[];
  readonly active: boolean;
  readonly locationCount?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteTourListFilter = {
  readonly active?: boolean;
  readonly recurrence?: WasteTourRecurrence;
  readonly wasteFractionId?: string;
  readonly search?: string;
};

export type WasteLocationTourLinkRecord = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteLocationTourLinkListFilter = {
  readonly locationId?: string;
  readonly tourId?: string;
};

export type WasteTourDateShiftRecord = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteTourDateShiftListFilter = {
  readonly tourId?: string;
  readonly hasYear?: boolean;
};

export type WasteGlobalDateShiftRecord = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly description?: string;
  readonly tourIds?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteGlobalDateShiftListFilter = {
  readonly hasYear?: boolean;
  readonly appliesToTourId?: string;
};
