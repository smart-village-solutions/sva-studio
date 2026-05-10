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

const addRecurringDates = (
  results: Set<string>,
  year: number,
  start: Date,
  end: Date,
  advance: (current: Date) => void
) => {
  const current = new Date(start);
  while (current <= end) {
    const iso = current.toISOString().slice(0, 10);
    if (iso.startsWith(`${year}-`)) {
      results.add(iso);
    }
    advance(current);
  }
};

const resolveAdvanceStrategy = (recurrence: WasteTourRecord['recurrence']) => {
  if (recurrence === 'weekly') {
    return (current: Date) => current.setDate(current.getDate() + 7);
  }
  if (recurrence === 'biweekly') {
    return (current: Date) => current.setDate(current.getDate() + 14);
  }
  if (recurrence === 'fourweekly') {
    return (current: Date) => current.setDate(current.getDate() + 28);
  }
  if (recurrence === 'yearly') {
    return (current: Date) => current.setFullYear(current.getFullYear() + 1);
  }
  return null;
};

const collectScheduledTourDates = (results: Set<string>, tour: WasteTourRecord, year: number) => {
  if (!tour.recurrence || !tour.firstDate) {
    return;
  }
  const start = new Date(`${tour.firstDate}T00:00:00`);
  const end = new Date(`${tour.endDate ?? `${year}-12-31`}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return;
  }
  const advance = resolveAdvanceStrategy(tour.recurrence);
  if (advance) {
    addRecurringDates(results, year, start, end, advance);
  }
};

const collectCustomTourDates = (results: Set<string>, tour: WasteTourRecord, year: number) => {
  for (const customDate of tour.customDates ?? []) {
    if (customDate.date.startsWith(`${year}-`)) {
      results.add(customDate.date);
    }
  }
};

const buildShiftMap = (
  shifts: readonly { readonly originalDate: string; readonly actualDate: string }[]
): Map<string, string> => new Map(shifts.map((shift) => [shift.originalDate, shift.actualDate] as const));

export const calculateTourOccurrencesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly string[] => {
  const results = new Set<string>();
  collectScheduledTourDates(results, tour, year);
  collectCustomTourDates(results, tour, year);

  const tourShiftMap = buildShiftMap(
    (scheduling.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id)
  );
  const globalShiftMap = buildShiftMap(
    (scheduling.globalDateShifts ?? []).filter((shift) => !shift.tourIds || shift.tourIds.includes(tour.id))
  );

  const shiftedResults = new Set<string>();
  for (const date of results) {
    shiftedResults.add(tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date);
  }

  return Array.from(shiftedResults)
    .filter((value) => value.startsWith(`${year}-`))
    .sort((left, right) => left.localeCompare(right));
};
