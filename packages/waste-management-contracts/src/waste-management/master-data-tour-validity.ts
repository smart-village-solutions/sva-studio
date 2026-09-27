import type { WasteTourRecord, WasteTourRecurrence } from './master-data-tours.js';

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
  if (input.firstDate.mode === 'clear') {
    return null;
  }

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
