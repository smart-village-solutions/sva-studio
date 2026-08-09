import type {
  WasteCollectionLocationRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

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
}>;

const shiftIsoDate = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
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

export const checkLocationFractionCoverage = ({
  locations,
  tours,
  links,
  fractionId,
  startDate,
  endDate,
}: CoverageCheckInput): readonly WasteLocationFractionCoverageIssue[] => {
  const matchingTourById = new Map(
    tours
      .filter((tour) => tour.wasteFractionIds.includes(fractionId))
      .map((tour) => [tour.id, tour] as const)
  );
  const toursByLocationId = new Map<string, WasteTourRecord[]>();

  for (const link of links) {
    const matchingTour = matchingTourById.get(link.tourId);
    if (!matchingTour) {
      continue;
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
      return [{
        locationId: location.id,
        kind: 'missing',
        gaps: [{ startDate, endDate }],
      }];
    }

    const gaps = findCoverageGaps(matchingTours, startDate, endDate);
    return gaps.length === 0
      ? []
      : [{ locationId: location.id, kind: 'incomplete', gaps }];
  });
};
