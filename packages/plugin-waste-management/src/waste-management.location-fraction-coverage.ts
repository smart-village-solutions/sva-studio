import {
  isWasteTourGlobalDateShiftApplicable,
  type WasteCollectionLocationRecord,
  type WasteLocationTourLinkRecord,
  type WasteTourRecord,
} from '@sva/waste-management-contracts';
import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import {
  calculateTourOccurrenceEntriesForYearInternal,
  resolveFixedTourCadenceDays,
} from './waste-management.tours.presentation.calendar.js';
import {
  applyTourHolidayRules,
  resolveHolidayRulesForYear,
} from './waste-management.tours.presentation.holidays.js';

export type WasteLocationFractionCoverageGap = Readonly<{
  startDate: string;
  endDate: string;
}>;

export type WasteLocationFractionCoverageIssue = Readonly<{
  locationId: string;
  kind: 'missing' | 'incomplete';
  gaps: readonly WasteLocationFractionCoverageGap[];
}>;

type CoverageCheckInput = Readonly<{
  locations: readonly WasteCollectionLocationRecord[];
  tours: readonly WasteTourRecord[];
  links: readonly WasteLocationTourLinkRecord[];
  fractionId: string;
  startDate: string;
  endDate: string;
  includeDrafts?: boolean;
  scheduling?: WasteManagementSchedulingOverview;
}>;

const shiftIsoDate = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
};

const isCoverageYearStart = (date: string) => /^\d{4}-01-01$/.test(date);

const matchesCoverageTour = (
  tour: WasteTourRecord,
  fractionId: string,
  includeDrafts: boolean
): boolean => (
  (tour.status === 'published' || (includeDrafts && tour.status === 'draft')) &&
  tour.wasteFractionIds.includes(fractionId)
);

export const needsCoverageScheduling = (
  input: Pick<CoverageCheckInput, 'startDate' | 'tours' | 'links' | 'fractionId' | 'includeDrafts'>
): boolean => {
  if (!isCoverageYearStart(input.startDate)) return false;
  const linkedTourIds = new Set(input.links.map((link) => link.tourId));
  return input.tours.some((tour) =>
    linkedTourIds.has(tour.id) &&
    matchesCoverageTour(tour, input.fractionId, input.includeDrafts ?? false) &&
    isWasteTourGlobalDateShiftApplicable(tour)
  );
};

const daysBetween = (startDate: string, endDate: string): number =>
  (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;

const resolveAnnualCoverageStart = (
  tour: WasteTourRecord,
  startDate: string,
  scheduling: WasteManagementSchedulingOverview,
  holidayRules: ReturnType<typeof resolveHolidayRulesForYear>
): string => {
  const nominalStart = tour.firstDate && tour.firstDate > startDate ? tour.firstDate : startDate;
  const year = Number(startDate.slice(0, 4));
  const fixedCadence = resolveFixedTourCadenceDays(tour.recurrence, tour.customRecurrenceIntervalDays);
  const cadenceDays = fixedCadence ??
    (tour.recurrence === 'yearly' ? daysBetween(startDate, `${year + 1}-01-01`) : null);
  if (cadenceDays === null || (tour.endDate && tour.endDate < startDate)) return nominalStart;

  const regularWindowEnd = shiftIsoDate(startDate, cadenceDays - 1);
  const [first] = calculateTourOccurrenceEntriesForYearInternal(
    { ...tour, customDates: [] },
    year,
    scheduling
  );
  let windowEnd = regularWindowEnd;
  if (first && first.date > regularWindowEnd) {
    const originalDate = first.originalDate;
    const holidayOnlyDate = originalDate && first.shiftedByHoliday
      ? applyTourHolidayRules(originalDate, scheduling, holidayRules).date
      : undefined;
    // A later cadence anchor may immediately follow a nominal slot postponed at New Year.
    const precedingSlot = shiftIsoDate(originalDate ?? first.date, -cadenceDays);
    const delayOnPrecedingSlot = precedingSlot >= startDate && precedingSlot <= regularWindowEnd
      ? daysBetween(precedingSlot, applyTourHolidayRules(precedingSlot, scheduling, holidayRules).date)
      : 0;
    const delayOnActualSlot = originalDate && holidayOnlyDate === first.date
      ? daysBetween(originalDate, holidayOnlyDate)
      : 0;
    windowEnd = shiftIsoDate(regularWindowEnd, Math.max(0, delayOnPrecedingSlot, delayOnActualSlot));
  }

  if (nominalStart > windowEnd) return nominalStart;
  if (first && first.date <= windowEnd) return startDate;
  return first?.date ?? shiftIsoDate(windowEnd, 1);
};

const findCoverageGaps = (
  tours: readonly WasteTourRecord[],
  startDate: string,
  endDate: string
): readonly WasteLocationFractionCoverageGap[] => {
  const intervals = tours
    .map((tour) => ({
      startDate: tour.firstDate && tour.firstDate > startDate ? tour.firstDate : startDate,
      endDate: tour.endDate && tour.endDate < endDate ? tour.endDate : endDate,
    }))
    .filter((interval) => interval.startDate <= interval.endDate)
    .sort((left, right) =>
      left.startDate === right.startDate
        ? left.endDate.localeCompare(right.endDate)
        : left.startDate.localeCompare(right.startDate)
    );

  const gaps: WasteLocationFractionCoverageGap[] = [];
  let uncoveredStart = startDate;

  for (const interval of intervals) {
    if (interval.endDate < uncoveredStart) {
      continue;
    }

    if (interval.startDate > uncoveredStart) {
      gaps.push({
        startDate: uncoveredStart,
        endDate: shiftIsoDate(interval.startDate, -1),
      });
    }

    const nextUncoveredDate = shiftIsoDate(interval.endDate, 1);
    if (nextUncoveredDate > uncoveredStart) {
      uncoveredStart = nextUncoveredDate;
    }
    if (uncoveredStart > endDate) {
      return gaps;
    }
  }

  if (uncoveredStart <= endDate) {
    gaps.push({ startDate: uncoveredStart, endDate });
  }

  return gaps;
};

const recheckInitialGap = (
  gaps: readonly WasteLocationFractionCoverageGap[],
  tours: readonly WasteTourRecord[],
  annualStarts: ReadonlyMap<string, string>,
  startDate: string,
  endDate: string
): readonly WasteLocationFractionCoverageGap[] => {
  if (annualStarts.size === 0) return gaps;
  let firstCoveredDate = shiftIsoDate(endDate, 1);
  for (const tour of tours) {
    const coveredFrom = annualStarts.get(tour.id);
    if (coveredFrom && coveredFrom < firstCoveredDate && (!tour.endDate || coveredFrom <= tour.endDate)) {
      firstCoveredDate = coveredFrom;
    }
  }
  const laterGaps = gaps.filter((gap) => gap.startDate > startDate);
  if (firstCoveredDate === startDate) return laterGaps;
  let initialGapEnd = shiftIsoDate(firstCoveredDate, -1);
  const remainingGaps = laterGaps.filter((gap) => {
    if (gap.startDate > shiftIsoDate(initialGapEnd, 1)) return true;
    if (gap.endDate > initialGapEnd) initialGapEnd = gap.endDate;
    return false;
  });
  return [{ startDate, endDate: initialGapEnd }, ...remainingGaps];
};

export const checkLocationFractionCoverage = ({
  locations,
  tours,
  links,
  fractionId,
  startDate,
  endDate,
  includeDrafts = false,
  scheduling,
}: CoverageCheckInput): readonly WasteLocationFractionCoverageIssue[] => {
  const matchingTourById = new Map(
    tours
      .filter((tour) => matchesCoverageTour(tour, fractionId, includeDrafts))
      .map((tour) => [tour.id, tour] as const)
  );
  const toursByLocationId = new Map<string, WasteTourRecord[]>();
  const annualStarts = new Map<string, string>();
  const annualScheduling = isCoverageYearStart(startDate) ? scheduling : undefined;
  const holidayRules = annualScheduling
    ? resolveHolidayRulesForYear(annualScheduling, Number(startDate.slice(0, 4)))
    : [];

  for (const link of links) {
    const matchingTour = matchingTourById.get(link.tourId);
    if (!matchingTour) {
      continue;
    }
    if (annualScheduling && !annualStarts.has(matchingTour.id)) {
      annualStarts.set(
        matchingTour.id,
        resolveAnnualCoverageStart(matchingTour, startDate, annualScheduling, holidayRules)
      );
    }
    const locationTours = toursByLocationId.get(link.locationId);
    if (locationTours) {
      locationTours.push(matchingTour);
    } else {
      toursByLocationId.set(link.locationId, [matchingTour]);
    }
  }

  return locations.flatMap((location): readonly WasteLocationFractionCoverageIssue[] => {
    if (!location.active) {
      return [];
    }

    const matchingTours = toursByLocationId.get(location.id) ?? [];
    if (matchingTours.length === 0) {
      return [
        {
          locationId: location.id,
          kind: 'missing',
          gaps: [{ startDate, endDate }],
        },
      ];
    }

    const gaps = recheckInitialGap(
      findCoverageGaps(matchingTours, startDate, endDate),
      matchingTours,
      annualStarts,
      startDate,
      endDate
    );
    return gaps.length === 0 ? [] : [{ locationId: location.id, kind: 'incomplete', gaps }];
  });
};
