export type WasteTourRecurrence =
  'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom';

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

export type WasteTourValidityDateOperation =
  | Readonly<{ mode: 'unchanged' }>
  | Readonly<{ mode: 'clear' }>
  | Readonly<{ mode: 'set'; value: string }>;

export type WasteTourValidityBulkUpdateInput = Readonly<{
  tourIds: readonly string[];
  firstDate: WasteTourValidityDateOperation;
  endDate: WasteTourValidityDateOperation;
}>;

export type WasteTourValidityBulkUpdateResult = Readonly<{
  updatedCount: number;
}>;

export type WasteTourValidityRecord = Pick<
  WasteTourRecord,
  'id' | 'recurrence' | 'customRecurrenceId' | 'firstDate' | 'endDate'
>;

export type WasteTourValidityDates = Readonly<{
  firstDate?: string;
  endDate?: string;
}>;

const recurringTourRecurrences = new Set<WasteTourRecurrence>([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
]);

export const isWasteTourValidityApplicable = (
  tour: Pick<WasteTourRecord, 'recurrence' | 'customRecurrenceId'>
): boolean =>
  Boolean(tour.customRecurrenceId) ||
  (tour.recurrence !== null &&
    tour.recurrence !== undefined &&
    recurringTourRecurrences.has(tour.recurrence));

const applyValidityDateOperation = (
  current: string | undefined,
  operation: WasteTourValidityDateOperation
): string | undefined => {
  if (operation.mode === 'set') {
    return operation.value;
  }
  if (operation.mode === 'clear') {
    return undefined;
  }
  return current;
};

export const resolveWasteTourValidityDates = (
  tour: Pick<WasteTourRecord, 'firstDate' | 'endDate'>,
  input: Pick<WasteTourValidityBulkUpdateInput, 'firstDate' | 'endDate'>
): WasteTourValidityDates | null => {
  const firstDate = applyValidityDateOperation(tour.firstDate, input.firstDate);
  const endDate = applyValidityDateOperation(tour.endDate, input.endDate);

  if (firstDate && endDate && endDate < firstDate) {
    return null;
  }

  return {
    ...(firstDate ? { firstDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
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
};

export type WasteLocationTourLinkBulkCreateResult = {
  readonly items: readonly WasteLocationTourLinkRecord[];
  readonly createdCount: number;
};

export type WasteManagementToursOverview = {
  readonly tours: readonly WasteTourRecord[];
  readonly customRecurrencePresets?: readonly WasteCustomRecurrencePresetRecord[];
};
