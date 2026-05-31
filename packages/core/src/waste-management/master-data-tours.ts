export type WasteTourRecurrence = 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom';

export type WasteCustomTourDate = {
  readonly date: string;
  readonly description?: string;
};

export type WasteCustomRecurrencePresetRecord = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly intervalDays: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteTourRecord = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence?: WasteTourRecurrence | null;
  readonly customRecurrenceId?: string;
  readonly customRecurrenceName?: string;
  readonly customRecurrenceIntervalDays?: number;
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

export type WasteLocationTourLinkBulkCreateInput = {
  readonly locationIds: readonly string[];
  readonly tourId: string;
  readonly startDate?: string;
  readonly endDate?: string;
};

export type WasteLocationTourLinkBulkCreateResult = {
  readonly items: readonly WasteLocationTourLinkRecord[];
  readonly createdCount: number;
};

export type WasteManagementToursOverview = {
  readonly tours: readonly WasteTourRecord[];
  readonly customRecurrencePresets?: readonly WasteCustomRecurrencePresetRecord[];
};
