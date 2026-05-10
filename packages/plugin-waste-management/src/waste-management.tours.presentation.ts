import type {
  WasteManagementSchedulingOverview,
  WasteTourRecord,
} from './waste-management.api.js';

export const formatTourRecurrence = (
  pt: (key: string) => string,
  value: WasteTourRecord['recurrence'] | undefined
) => {
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

export const calculateTourOccurrencesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly string[] => {
  const results = new Set<string>();

  const addDate = (value?: string) => {
    if (value?.startsWith(`${year}-`)) {
      results.add(value);
    }
  };

  if (tour.recurrence && tour.firstDate) {
    const start = new Date(`${tour.firstDate}T00:00:00`);
    const end = new Date(`${tour.endDate ?? `${year}-12-31`}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const current = new Date(start);
      const advanceDays =
        tour.recurrence === 'weekly'
          ? 7
          : tour.recurrence === 'biweekly'
            ? 14
            : tour.recurrence === 'fourweekly'
              ? 28
              : null;

      if (advanceDays !== null) {
        while (current <= end) {
          const iso = current.toISOString().slice(0, 10);
          addDate(iso);
          current.setDate(current.getDate() + advanceDays);
        }
      } else if (tour.recurrence === 'yearly') {
        while (current <= end) {
          const iso = current.toISOString().slice(0, 10);
          addDate(iso);
          current.setFullYear(current.getFullYear() + 1);
        }
      }
    }
  }

  for (const customDate of tour.customDates ?? []) {
    addDate(customDate.date);
  }

  const tourShiftMap = new Map(
    (scheduling.tourDateShifts ?? [])
      .filter((shift) => shift.tourId === tour.id)
      .map((shift) => [shift.originalDate, shift.actualDate] as const)
  );
  const globalShiftMap = new Map(
    (scheduling.globalDateShifts ?? [])
      .filter((shift) => !shift.tourIds || shift.tourIds.includes(tour.id))
      .map((shift) => [shift.originalDate, shift.actualDate] as const)
  );

  const shiftedResults = new Set<string>();
  for (const date of results) {
    shiftedResults.add(tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date);
  }

  return Array.from(shiftedResults)
    .filter((value) => value.startsWith(`${year}-`))
    .sort((left, right) => left.localeCompare(right));
};
