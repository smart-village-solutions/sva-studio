import { formatCalendarDate } from '@sva/plugin-sdk';
import type { WasteManagementSchedulingOverview, WasteTourRecord } from './waste-management.api.js';
import { calculateTourOccurrenceEntriesForYearInternal } from './waste-management.tours.presentation.calendar.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
type TourValidity = Pick<WasteTourRecord, 'firstDate' | 'endDate' | 'recurrence' | 'customDates'>;

export const formatTourRecurrence = (
  pt: Translate,
  value: WasteTourRecord['recurrence'] | undefined,
  customRecurrenceName?: string,
  customRecurrenceIntervalDays?: number
) => {
  if (customRecurrenceName) {
    if (typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
      return pt('tours.meta.customRecurrenceLabel', {
        name: customRecurrenceName,
        days: customRecurrenceIntervalDays,
      });
    }
    return customRecurrenceName;
  }

  if (!value) {
    return '—';
  }

  const translationKeyMap = {
    weekly: 'tours.recurrence.weekly',
    biweekly: 'tours.recurrence.biweekly',
    fourweekly: 'tours.recurrence.fourweekly',
    yearly: 'tours.recurrence.yearly',
    'on-demand': 'tours.recurrence.onDemand',
    custom: 'tours.recurrence.custom',
  } as const satisfies Record<NonNullable<WasteTourRecord['recurrence']>, string>;

  return pt(translationKeyMap[value as NonNullable<WasteTourRecord['recurrence']>]);
};

export const formatTourDateRange = (pt: Translate, tour: TourValidity): string | undefined => {
  const firstDate = tour.firstDate ? formatCalendarDate(tour.firstDate) : undefined;
  const endDate = tour.endDate ? formatCalendarDate(tour.endDate) : undefined;
  if (firstDate && endDate) return `${firstDate} – ${endDate}`;
  if (firstDate) return `${pt('tours.fields.firstDate')} ${firstDate}`;
  if (endDate) return `${pt('tours.fields.endDate')} ${endDate}`;
  if (tour.recurrence === 'custom' || tour.customDates?.length) return pt('tours.fields.customDates');
  return undefined;
};

export const formatTourSelectionLabel = (
  pt: Translate,
  tour: TourValidity & Pick<WasteTourRecord, 'name'>
): string => {
  const range = formatTourDateRange(pt, tour);
  return range ? `${tour.name} (${range})` : tour.name;
};

export { calculateTourCalendarForYear } from './waste-management.tours.presentation.calendar.js';
export { resolveTourShiftDetails } from './waste-management.tours.presentation.shift-details.js';
export type { TourShiftDetail } from './waste-management.tours.presentation.shift-details.js';

export const calculateTourOccurrencesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly string[] =>
  calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).map((entry) => entry.date);

export const calculateTourOccurrenceEntriesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly Readonly<{
  readonly date: string;
  readonly shifted: boolean;
  readonly originalDate: string | null;
}>[] =>
  calculateTourOccurrenceEntriesForYearInternal(tour, year, scheduling).map(
    ({ date, shifted, originalDate }) => ({
      date,
      shifted,
      originalDate,
    })
  );
