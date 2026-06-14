import type {
  WasteCityRecord,
  WasteTourRecord,
  WasteLocationTourLinkRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourPickupDateRecord,
  WasteStreetRecord,
} from '@sva/core';
import {
  addDays,
  addDaysWithWeekendClampForAdvance,
  collectRecurrenceDates,
  getEffectiveYearWindow,
  isAllowedByRuleYear,
  isDateAffectedByRule,
  isDateInRange,
  parseIsoDateUtc,
  setIsoDateYear,
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
  const sourcePriority: Record<MaterializationRule['source'], number> = {
    tour: 0,
    global: 1,
    holiday: 2,
  };
  if (left.triggerDate !== right.triggerDate) {
    return left.triggerDate.localeCompare(right.triggerDate);
  }
  if (left.source !== right.source) {
    return sourcePriority[left.source] - sourcePriority[right.source];
  }
  if (left.shiftDays !== right.shiftDays) {
    return left.shiftDays - right.shiftDays;
  }
  return 0;
};

const isShiftRelevantToYearWindow = (
  originalDate: string,
  actualDate: string,
  hasYear: boolean,
  yearWindow: readonly number[]
): boolean => {
  if (!hasYear) {
    return true;
  }

  return (
    isAllowedByRuleYear(originalDate, true, yearWindow) ||
    isAllowedByRuleYear(actualDate, true, yearWindow)
  );
};

const expandRuleAcrossYearWindow = (
  rule: MaterializationRule,
  yearWindow: readonly number[]
): readonly MaterializationRule[] => {
  if (rule.hasYear) {
    return [rule];
  }

  return yearWindow.flatMap((year) => {
    const triggerDate = setIsoDateYear(rule.triggerDate, year);
    if (!triggerDate || !parseIsoDateUtc(triggerDate)) {
      return [];
    }

    return [
      {
        ...rule,
        triggerDate,
        hasYear: true,
      },
    ];
  });
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
    if (!isShiftRelevantToYearWindow(shift.originalDate, shift.actualDate, shift.hasYear, yearWindow)) {
      continue;
    }
    tourRules.push(...expandRuleAcrossYearWindow(rule, yearWindow));
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
    if (!isShiftRelevantToYearWindow(shift.originalDate, shift.actualDate, shift.hasYear, yearWindow)) {
      continue;
    }
    globalRules.push(...expandRuleAcrossYearWindow(rule, yearWindow));
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
      shiftDays: 1,
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
  dates: readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[],
  rule: MaterializationRule,
): readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[] => {
  const next = dates.map((entry) => {
    if (!isDateAffectedByRule(entry.pickupDate, rule)) {
      return entry;
    }

    const shifted = rule.direction === 'advance'
      ? addDaysWithWeekendClampForAdvance(entry.pickupDate, -rule.shiftDays)
      : addDays(entry.pickupDate, rule.shiftDays);

    return shifted
      ? {
          ...entry,
          pickupDate: shifted,
        }
      : entry;
  });

  const deduplicated = new Map<string, Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>>();
  for (const entry of next) {
    if (typeof entry.pickupDate !== 'string' || entry.pickupDate.length === 0) {
      continue;
    }
    const current = deduplicated.get(entry.pickupDate);
    if (!current || (current.note == null && entry.note != null)) {
      deduplicated.set(entry.pickupDate, entry);
    }
  }
  return [...deduplicated.values()].sort((left, right) => left.pickupDate.localeCompare(right.pickupDate));
};

export type MaterializedLocationTourPickupDateRecord = Omit<WasteLocationTourPickupDateRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Readonly<{
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }>;

export const buildMaterializedLocationTourPickupDates = (input: WasteMaterializationContext): readonly MaterializedLocationTourPickupDateRecord[] => {
  const yearWindow = getEffectiveYearWindow(input.currentYear, input.nextYear);
  const collectionYearWindow = Array.from(new Set([yearWindow[0] - 1, ...yearWindow])).sort();
  const syncYearSet = new Set(yearWindow);
  const rules = buildMaterializationRules({ ...input, currentYear: yearWindow[0], nextYear: yearWindow[1] });
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const importedPickupDatesByLocationTourKey = new Map<
    string,
    Array<Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>>
  >();
  for (const pickupDate of input.locationTourPickupDates ?? []) {
    const parsedPickupDate = parseIsoDateUtc(pickupDate.pickupDate);
    if (!parsedPickupDate || !collectionYearWindow.includes(parsedPickupDate.getUTCFullYear())) {
      continue;
    }

    const key = `${pickupDate.locationId}::${pickupDate.tourId}`;
    const entries = importedPickupDatesByLocationTourKey.get(key) ?? [];
    entries.push({
      pickupDate: pickupDate.pickupDate,
      note: pickupDate.note,
    });
    importedPickupDatesByLocationTourKey.set(key, entries);
  }
  const pickupDates: MaterializedLocationTourPickupDateRecord[] = [];

  for (const link of input.links) {
    const tour = tourById.get(link.tourId);
    if (!tour || !tour.active) {
      continue;
    }

    const locationTourKey = `${link.locationId}::${link.tourId}`;
    let dates: readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[] = [
      ...collectRecurrenceDates(tour, collectionYearWindow).map((pickupDate) => ({
        pickupDate,
        note: null,
      })),
      ...(importedPickupDatesByLocationTourKey.get(locationTourKey) ?? []),
    ].filter((entry) => isDateInRange(entry.pickupDate, link.startDate, link.endDate));
    dates = [...dates
      .reduce((deduplicated, entry) => {
        const current = deduplicated.get(entry.pickupDate);
        if (!current || (current.note == null && entry.note != null)) {
          deduplicated.set(entry.pickupDate, entry);
        }
        return deduplicated;
      }, new Map<string, Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>>())
      .values()]
      .sort((left, right) => left.pickupDate.localeCompare(right.pickupDate));
    if (dates.length === 0) {
      continue;
    }

    for (const rule of rules) {
      if (!isRuleApplicableToTour(rule, link.tourId)) {
        continue;
      }
      dates = applySingleRule(dates, rule);
      dates = dates.filter((entry) => isDateInRange(entry.pickupDate, link.startDate, link.endDate));
      if (dates.length === 0) {
        break;
      }
    }

    dates = dates.filter((entry) => {
      const parsedDate = parseIsoDateUtc(entry.pickupDate);
      return parsedDate ? syncYearSet.has(parsedDate.getUTCFullYear()) : false;
    });
    if (dates.length === 0) {
      continue;
    }

    for (const pickupDate of dates) {
      pickupDates.push({
        id: `materialized-${link.locationId}-${link.tourId}-${pickupDate.pickupDate}`,
        locationId: link.locationId,
        tourId: link.tourId,
        pickupDate: pickupDate.pickupDate,
        note: pickupDate.note,
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
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
}): readonly {
  readonly pickupDate: string;
  readonly wasteType: string;
  readonly street: string;
  readonly zip?: string;
  readonly city: string;
  readonly note?: string;
  readonly key: string;
}[] => {
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const fractionById = new Map(input.fractions.map((fraction) => [fraction.id, fraction] as const));
  const locationById = new Map(input.locations.map((location) => [location.id, location] as const));
  const cityById = new Map(input.cities.map((city) => [city.id, city] as const));
  const streetById = new Map(input.streets.map((street) => [street.id, street] as const));
  const linkByLocationTourKey = new Map(input.links.map((link) => [`${link.locationId}::${link.tourId}`, link] as const));

  return input.pickupDates.flatMap((pickupDate) => {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    const link = linkByLocationTourKey.get(`${pickupDate.locationId}::${pickupDate.tourId}`);
    if (!tour || !location || !link || !location.active) {
      return [];
    }

    const city = cityById.get(location.cityId)?.name?.trim();
    if (!city) {
      return [];
    }

    const street = location.streetId ? streetById.get(location.streetId)?.name?.trim() : undefined;
    if (!street) {
      return [];
    }

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
        city.toLocaleLowerCase('de-DE'),
      ];

      return [
        {
          pickupDate: pickupDate.pickupDate,
          wasteType,
          street,
          city,
          note: pickupDate.note ?? undefined,
          key: keyParts.join('::'),
        },
      ];
    });
  });
};
