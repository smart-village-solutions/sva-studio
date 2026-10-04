import type { WasteTourRecord } from './waste-management.api.js';

export const formatTourRecurrence = (
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string,
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

export const formatTourDateRange = (tour: WasteTourRecord) => {
  if (tour.firstDate && tour.endDate) {
    return `${tour.firstDate} – ${tour.endDate}`;
  }
  return tour.firstDate ?? tour.endDate ?? '—';
};

export {
  calculateTourOccurrencesForYear,
  calculateTourOccurrenceEntriesForYear,
} from './waste-management.tours.presentation.calendar.js';
export { resolveTourShiftDetails } from './waste-management.tours.presentation.shift-details.js';
export type { TourShiftDetail } from './waste-management.tours.presentation.shift-details.js';
