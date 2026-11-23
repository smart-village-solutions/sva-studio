import type { WasteTourRecord } from '@sva/waste-management-contracts';
import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import {
  calculateTourOccurrenceEntriesForYearInternal,
  resolveFixedTourCadenceDays,
} from './waste-management.tours.presentation.calendar.js';
import {
  applyTourHolidayRules,
  resolveHolidayRulesForYear,
} from './waste-management.tours.presentation.holidays.js';

export const shiftIsoDate = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
};

const daysBetween = (startDate: string, endDate: string): number =>
  (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;

const extendCoverageWindow = (
  first: ReturnType<typeof calculateTourOccurrenceEntriesForYearInternal>[number],
  startDate: string,
  regularWindowEnd: string,
  cadenceDays: number,
  scheduling: WasteManagementSchedulingOverview,
  holidayRules: ReturnType<typeof resolveHolidayRulesForYear>
): string => {
  const originalDate = first.originalDate;
  const holidayOnlyDate =
    originalDate && first.shiftedByHoliday
      ? applyTourHolidayRules(originalDate, scheduling, holidayRules).date
      : undefined;
  // A later cadence anchor may immediately follow a nominal slot postponed at New Year.
  const precedingSlot = shiftIsoDate(originalDate ?? first.date, -cadenceDays);
  const delayOnPrecedingSlot =
    precedingSlot >= startDate && precedingSlot <= regularWindowEnd
      ? daysBetween(
          precedingSlot,
          applyTourHolidayRules(precedingSlot, scheduling, holidayRules).date
        )
      : 0;
  const delayOnActualSlot =
    originalDate && holidayOnlyDate === first.date ? daysBetween(originalDate, holidayOnlyDate) : 0;
  return shiftIsoDate(regularWindowEnd, Math.max(0, delayOnPrecedingSlot, delayOnActualSlot));
};

export const resolveAnnualCoverageStart = (
  tour: WasteTourRecord,
  startDate: string,
  scheduling: WasteManagementSchedulingOverview,
  holidayRules: ReturnType<typeof resolveHolidayRulesForYear>
): string => {
  const nominalStart = tour.firstDate && tour.firstDate > startDate ? tour.firstDate : startDate;
  const year = Number(startDate.slice(0, 4));
  const fixedCadence = resolveFixedTourCadenceDays(
    tour.recurrence,
    tour.customRecurrenceIntervalDays
  );
  const cadenceDays =
    fixedCadence ??
    (tour.recurrence === 'yearly' ? daysBetween(startDate, `${year + 1}-01-01`) : null);
  if (cadenceDays === null || (tour.endDate && tour.endDate < startDate)) return nominalStart;

  const regularWindowEnd = shiftIsoDate(startDate, cadenceDays - 1);
  const [first] = calculateTourOccurrenceEntriesForYearInternal(
    { ...tour, customDates: [] },
    year,
    scheduling
  );
  const windowEnd =
    first && first.date > regularWindowEnd
      ? extendCoverageWindow(
          first,
          startDate,
          regularWindowEnd,
          cadenceDays,
          scheduling,
          holidayRules
        )
      : regularWindowEnd;

  if (first) return first.date <= windowEnd ? startDate : first.date;
  return nominalStart > windowEnd ? nominalStart : shiftIsoDate(windowEnd, 1);
};
