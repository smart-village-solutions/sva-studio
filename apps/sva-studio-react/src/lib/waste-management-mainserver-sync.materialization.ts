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

const normalizeHolidayTriggerDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

const buildMaterializationRules = (
  input: WasteMaterializationContext
): readonly MaterializationRule[] => {
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
    if (
      !isShiftRelevantToYearWindow(shift.originalDate, shift.actualDate, shift.hasYear, yearWindow)
    ) {
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
    if (
      !isShiftRelevantToYearWindow(shift.originalDate, shift.actualDate, shift.hasYear, yearWindow)
    ) {
      continue;
    }
    globalRules.push(...expandRuleAcrossYearWindow(rule, yearWindow));
  }

  const holidayRules: MaterializationRule[] = [];
  for (const rule of input.holidayRules) {
    const holidayDate = normalizeHolidayTriggerDate(rule.holidayDate);
    if (!holidayDate || !rule.scope || !rule.strategy) {
      continue;
    }
    const direction = toDirectionFromHolidayStrategy(rule.strategy);
    if (!direction) {
      continue;
    }

    const candidate: MaterializationRule = {
      source: 'holiday' as const,
      triggerDate: holidayDate,
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
  rule: MaterializationRule
): readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[] => {
  const next = dates.map((entry) => {
    if (!isDateAffectedByRule(entry.pickupDate, rule)) {
      return entry;
    }

    const shifted =
      rule.direction === 'advance'
        ? addDaysWithWeekendClampForAdvance(entry.pickupDate, -rule.shiftDays)
        : addDays(entry.pickupDate, rule.shiftDays);

    return shifted
      ? {
          ...entry,
          pickupDate: shifted,
        }
      : entry;
  });

  const deduplicated = new Map<
    string,
    Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>
  >();
  for (const entry of next) {
    if (typeof entry.pickupDate !== 'string' || entry.pickupDate.length === 0) {
      continue;
    }
    const current = deduplicated.get(entry.pickupDate);
    if (!current || (current.note == null && entry.note != null)) {
      deduplicated.set(entry.pickupDate, entry);
    }
  }
  return [...deduplicated.values()].sort((left, right) =>
    left.pickupDate.localeCompare(right.pickupDate)
  );
};

export type MaterializedLocationTourPickupDateRecord = Omit<
  WasteLocationTourPickupDateRecord,
  'id' | 'createdAt' | 'updatedAt'
> &
  Readonly<{
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }>;

const toOccurrenceKey = (
  entry: Pick<MaterializedLocationTourPickupDateRecord, 'locationId' | 'tourId' | 'pickupDate'>
): string => `${entry.locationId}::${entry.tourId}::${entry.pickupDate}`;

const mergeMaterializedPickupDates = (
  calculated: readonly MaterializedLocationTourPickupDateRecord[],
  assigned: readonly MaterializedLocationTourPickupDateRecord[]
): readonly MaterializedLocationTourPickupDateRecord[] => {
  const assignedKeys = new Set(assigned.map(toOccurrenceKey));
  const seenCalculatedKeys = new Set<string>();
  const uniqueCalculated = calculated.filter((entry) => {
    const key = toOccurrenceKey(entry);
    if (assignedKeys.has(key) || seenCalculatedKeys.has(key)) {
      return false;
    }
    seenCalculatedKeys.add(key);
    return true;
  });

  return [...uniqueCalculated, ...assigned].sort(
    (left, right) =>
      left.locationId.localeCompare(right.locationId) ||
      left.tourId.localeCompare(right.tourId) ||
      left.pickupDate.localeCompare(right.pickupDate) ||
      left.id.localeCompare(right.id)
  );
};

const materializeLinkedPickupDates = (input: {
  readonly link: WasteMaterializationContext['links'][number];
  readonly tourById: ReadonlyMap<string, WasteTourRecord>;
  readonly importedByLocationTourKey: ReadonlyMap<
    string,
    readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[]
  >;
  readonly collectionYearWindow: readonly number[];
  readonly syncYearSet: ReadonlySet<number>;
  readonly rules: readonly MaterializationRule[];
}): readonly MaterializedLocationTourPickupDateRecord[] => {
  const { link } = input;
  const tour = input.tourById.get(link.tourId);
  if (!tour?.active) return [];

  const locationTourKey = `${link.locationId}::${link.tourId}`;
  let dates: readonly Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>[] = [
    ...collectRecurrenceDates(tour, input.collectionYearWindow).map((pickupDate) => ({
      pickupDate,
      note: null,
    })),
    ...(input.importedByLocationTourKey.get(locationTourKey) ?? []),
  ].filter((entry) => isDateInRange(entry.pickupDate, tour.firstDate, tour.endDate));
  dates = [
    ...dates
      .reduce((deduplicated, entry) => {
        const current = deduplicated.get(entry.pickupDate);
        if (!current || (current.note == null && entry.note != null)) {
          deduplicated.set(entry.pickupDate, entry);
        }
        return deduplicated;
      }, new Map<string, Pick<WasteLocationTourPickupDateRecord, 'pickupDate' | 'note'>>())
      .values(),
  ].sort((left, right) => left.pickupDate.localeCompare(right.pickupDate));

  for (const rule of input.rules) {
    if (!isRuleApplicableToTour(rule, link.tourId)) continue;
    dates = applySingleRule(dates, rule).filter((entry) =>
      isDateInRange(entry.pickupDate, tour.firstDate, tour.endDate)
    );
    if (dates.length === 0) break;
  }

  return dates
    .filter((entry) => {
      const parsedDate = parseIsoDateUtc(entry.pickupDate);
      return parsedDate ? input.syncYearSet.has(parsedDate.getUTCFullYear()) : false;
    })
    .map((pickupDate) => ({
      id: `materialized-${link.locationId}-${link.tourId}-${pickupDate.pickupDate}`,
      locationId: link.locationId,
      tourId: link.tourId,
      pickupDate: pickupDate.pickupDate,
      note: pickupDate.note,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
    }));
};

const materializeAssignedPickupDates = (
  assignments: WasteMaterializationContext['tourAssignments'],
  tourById: ReadonlyMap<string, WasteTourRecord>,
  syncYearSet: ReadonlySet<number>
): readonly MaterializedLocationTourPickupDateRecord[] =>
  (assignments ?? []).flatMap((assignment) => {
    const parsedDate = parseIsoDateUtc(assignment.pickupDate);
    if (!tourById.get(assignment.tourId)?.active || !parsedDate) return [];
    if (!syncYearSet.has(parsedDate.getUTCFullYear())) return [];
    return assignment.locationIds.map((locationId) => ({
      id: `assignment-${assignment.id}-${locationId}`,
      locationId,
      tourId: assignment.tourId,
      pickupDate: assignment.pickupDate,
      note: assignment.note,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    }));
  });

export const buildMaterializedLocationTourPickupDates = (
  input: WasteMaterializationContext
): readonly MaterializedLocationTourPickupDateRecord[] => {
  const yearWindow = getEffectiveYearWindow(input.currentYear, input.nextYear);
  const collectionYearWindow = Array.from(new Set([yearWindow[0] - 1, ...yearWindow])).sort(
    (left, right) => left - right
  );
  const syncYearSet = new Set(yearWindow);
  const rules = buildMaterializationRules({
    ...input,
    currentYear: yearWindow[0],
    nextYear: yearWindow[1],
  });
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
  const calculatedPickupDates = input.links.flatMap((link) =>
    materializeLinkedPickupDates({
      link,
      tourById,
      importedByLocationTourKey: importedPickupDatesByLocationTourKey,
      collectionYearWindow,
      syncYearSet,
      rules,
    })
  );
  const assignedPickupDates = materializeAssignedPickupDates(
    input.tourAssignments,
    tourById,
    syncYearSet
  );

  return mergeMaterializedPickupDates(calculatedPickupDates, assignedPickupDates);
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
  return input.pickupDates.flatMap((pickupDate) => {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    if (!tour || !location || !location.active) {
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
