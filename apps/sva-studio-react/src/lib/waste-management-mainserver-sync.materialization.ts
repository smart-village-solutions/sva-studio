import type {
  WasteTourRecord,
  WasteLocationTourLinkRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourPickupDateRecord,
} from '@sva/core';
import {
  addDays,
  addDaysWithWeekendClampForAdvance,
  collectRecurrenceDates,
  getEffectiveYearWindow,
  isAllowedByRuleYear,
  isDateAffectedByRule,
  isDateInRange,
  shiftDirection,
  toCoverage,
  toDirectionFromHolidayStrategy,
  type MaterializationRule,
  type WasteMaterializationContext,
} from './waste-management-mainserver-sync.materialization.shared.js';

const isRuleApplicableToTour = (rule: MaterializationRule, tourId: string): boolean => {
  if (rule.appliesToTourId && rule.appliesToTourId !== tourId) {
    return false;
  }
  if (!rule.appliesToTourIds) {
    return true;
  }
  if (rule.appliesToTourIds.length === 0) {
    return true;
  }
  return rule.appliesToTourIds.includes(tourId);
};

const sortMaterializationRules = (
  left: Pick<MaterializationRule, 'triggerDate' | 'source' | 'shiftDays'>,
  right: Pick<MaterializationRule, 'triggerDate' | 'source' | 'shiftDays'>
): number => {
  if (left.triggerDate !== right.triggerDate) {
    return left.triggerDate.localeCompare(right.triggerDate);
  }
  if (left.source !== right.source) {
    return left.source.localeCompare(right.source);
  }
  if (left.shiftDays !== right.shiftDays) {
    return left.shiftDays - right.shiftDays;
  }
  return 0;
};

const buildMaterializationRules = (input: WasteMaterializationContext): readonly MaterializationRule[] => {
  const yearWindow = getEffectiveYearWindow(input.currentYear, input.nextYear);
  const tourRules: MaterializationRule[] = [];
  for (const shift of input.tourDateShifts) {
    const move = shiftDirection(shift.originalDate, shift.actualDate);
    if (!move) {
      continue;
    }

    const rule: MaterializationRule = {
      source: 'tour' as const,
      appliesToTourId: shift.tourId,
      triggerDate: shift.originalDate,
      shiftDays: move.shiftDays,
      direction: move.direction,
      coverage: toCoverage(shift.followUpMode),
      hasYear: shift.hasYear,
    };

    if (isAllowedByRuleYear(rule.triggerDate, rule.hasYear, yearWindow)) {
      tourRules.push(rule);
    }
  }

  const globalRules: MaterializationRule[] = [];
  for (const shift of input.globalDateShifts) {
    const move = shiftDirection(shift.originalDate, shift.actualDate);
    if (!move) {
      continue;
    }

    const rule: MaterializationRule = {
      source: 'global' as const,
      triggerDate: shift.originalDate,
      shiftDays: move.shiftDays,
      direction: move.direction,
      coverage: 'single_pickup' as const,
      appliesToTourIds: shift.tourIds,
      hasYear: shift.hasYear,
    };

    if (isAllowedByRuleYear(rule.triggerDate, rule.hasYear, yearWindow)) {
      globalRules.push(rule);
    }
  }

  const holidayRules: MaterializationRule[] = [];
  for (const rule of input.holidayRules) {
    if (!rule.holidayDate.trim() || !rule.scope || !rule.strategy) {
      continue;
    }
    const direction = toDirectionFromHolidayStrategy(rule.strategy);
    if (!direction) {
      continue;
    }

    const candidate: MaterializationRule = {
      source: 'holiday' as const,
      triggerDate: rule.holidayDate,
      shiftDays: direction === 'advance' ? 1 : 1,
      direction,
      coverage: rule.scope === 'full-week' ? 'rest_of_week' : 'single_pickup',
      hasYear: true,
    };
    if (isAllowedByRuleYear(candidate.triggerDate, candidate.hasYear, yearWindow)) {
      holidayRules.push(candidate);
    }
  }

  return [...tourRules, ...globalRules, ...holidayRules]
    .filter((rule) => !(rule.shiftDays === 0 && rule.coverage === 'rest_of_week'))
    .sort((left, right) => sortMaterializationRules(left, right));
};

const applySingleRule = (
  dates: readonly string[],
  rule: MaterializationRule,
): readonly string[] => {
  const next = dates.map((date) => {
    if (!isDateAffectedByRule(date, rule)) {
      return date;
    }

    const shifted = rule.direction === 'advance'
      ? addDaysWithWeekendClampForAdvance(date, -rule.shiftDays)
      : addDays(date, rule.shiftDays);

    return shifted;
  });
  return [...new Set(next.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))].sort();
};

export type MaterializedLocationTourPickupDateRecord = Omit<WasteLocationTourPickupDateRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Readonly<{
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }>;

export const buildMaterializedLocationTourPickupDates = (input: WasteMaterializationContext): readonly MaterializedLocationTourPickupDateRecord[] => {
  const yearWindow = getEffectiveYearWindow(input.currentYear, input.nextYear);
  const rules = buildMaterializationRules({ ...input, currentYear: yearWindow[0], nextYear: yearWindow[1] });
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const pickupDates: MaterializedLocationTourPickupDateRecord[] = [];

  for (const link of input.links) {
    const tour = tourById.get(link.tourId);
    if (!tour || !tour.active) {
      continue;
    }

    let dates: readonly string[] = collectRecurrenceDates(tour, yearWindow)
      .filter((date) => isDateInRange(date, link.startDate, link.endDate))
      .sort();
    if (dates.length === 0) {
      continue;
    }

    for (const rule of rules) {
      if (!isRuleApplicableToTour(rule, link.tourId)) {
        continue;
      }
      dates = applySingleRule(dates, rule);
      dates = dates.filter((date) => isDateInRange(date, link.startDate, link.endDate));
      if (dates.length === 0) {
        break;
      }
    }

    for (const pickupDate of dates) {
      pickupDates.push({
        id: `materialized-${link.locationId}-${link.tourId}-${pickupDate}`,
        locationId: link.locationId,
        tourId: link.tourId,
        pickupDate,
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
      });
    }
  }

  const seen = new Set<string>();
  return [...pickupDates]
    .filter((entry) => {
      const key = `${entry.locationId}::${entry.tourId}::${entry.pickupDate}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      left.locationId.localeCompare(right.locationId) || left.tourId.localeCompare(right.tourId) || left.pickupDate.localeCompare(right.pickupDate)
    );
};

export const buildStudioRowsFromMaterialization = (input: {
  readonly pickupDates: readonly MaterializedLocationTourPickupDateRecord[];
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly locations: readonly WasteCollectionLocationRecord[];
}): readonly {
  readonly pickupDate: string;
  readonly wasteType: string;
  readonly street: string;
  readonly zip?: string;
  readonly city: string;
  readonly key: string;
}[] => {
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const fractionById = new Map(input.fractions.map((fraction) => [fraction.id, fraction] as const));
  const locationById = new Map(input.locations.map((location) => [location.id, location] as const));
  const linkByLocationTourKey = new Map(input.links.map((link) => [`${link.locationId}::${link.tourId}`, link] as const));

  return input.pickupDates.flatMap((pickupDate) => {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    const link = linkByLocationTourKey.get(`${pickupDate.locationId}::${pickupDate.tourId}`);
    if (!tour || !location || !link) {
      return [];
    }

    const street = location.streetId ? location.streetId : `location-${location.id}`;
    const city = location.cityId;

    return tour.wasteFractionIds.flatMap((fractionId) => {
      const fraction = fractionById.get(fractionId);
      const wasteType = fraction?.name?.trim();
      if (!wasteType) {
        return [];
      }

      const keyParts = [
        pickupDate.pickupDate,
        wasteType.toLocaleLowerCase('de-DE'),
        street.toLocaleLowerCase('de-DE'),
        (undefined as string | undefined),
        city.toLocaleLowerCase('de-DE'),
      ];

      return [
        {
          pickupDate: pickupDate.pickupDate,
          wasteType,
          street,
          city,
          key: keyParts.join('::'),
        },
      ];
    });
  });
};
