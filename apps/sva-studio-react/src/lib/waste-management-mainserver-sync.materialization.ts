import type {
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteLocationTourLinkRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteLocationTourPickupDateRecord,
} from '@sva/core';

type MaterializationRuleCoverage = 'single_pickup' | 'rest_of_week';
type MaterializationRuleDirection = 'advance' | 'postpone';
type MaterializationRuleSource = 'tour' | 'global' | 'holiday';

type MaterializationRule = {
  readonly source: MaterializationRuleSource;
  readonly appliesToTourId?: string;
  readonly appliesToTourIds?: readonly string[];
  readonly triggerDate: string;
  readonly shiftDays: number;
  readonly direction: MaterializationRuleDirection;
  readonly coverage: MaterializationRuleCoverage;
  readonly hasYear: boolean;
};

const MATERIALIZATION_YEAR_OFFSET = 1;

export type WasteMaterializationContext = {
  readonly tours: readonly WasteTourRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly currentYear: number;
  readonly nextYear: number;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDateUtc = (value: string): Date | undefined => {
  if (!isoDatePattern.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: string, days: number): string | undefined => {
  const date = parseIsoDateUtc(value);
  if (!date) {
    return undefined;
  }
  const shiftedDate = new Date(date);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return Number.isNaN(shiftedDate.getTime()) ? undefined : toIsoDate(shiftedDate);
};

const addDaysWithWeekendClampForAdvance = (value: string, shiftDays: number): string | undefined => {
  const shiftedDate = addDays(value, shiftDays);
  if (!shiftedDate) {
    return undefined;
  }
  if (shiftDays >= 0) {
    return shiftedDate;
  }
  const date = parseIsoDateUtc(shiftedDate);
  if (!date) {
    return shiftedDate;
  }

  // Historical business behavior: if an advance move would land on Sunday, use Saturday.
  if (date.getUTCDay() === 0) {
    return addDays(shiftedDate, -1);
  }

  return shiftedDate;
};

const shiftDirection = (
  originalDate: string,
  actualDate: string
): { readonly direction: MaterializationRuleDirection; readonly shiftDays: number } | undefined => {
  const original = parseIsoDateUtc(originalDate);
  const actual = parseIsoDateUtc(actualDate);
  if (!original || !actual) {
    return undefined;
  }
  const dayDistance = Math.round((actual.getTime() - original.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(dayDistance) || dayDistance === 0) {
    return undefined;
  }

  return {
    direction: dayDistance > 0 ? 'postpone' : 'advance',
    shiftDays: Math.abs(dayDistance),
  };
};

const toCoverage = (followUpMode: WasteTourDateShiftFollowUpMode | undefined): MaterializationRuleCoverage =>
  followUpMode === 'propagate-series' ? 'rest_of_week' : 'single_pickup';

const toDirectionFromHolidayStrategy = (strategy: string | undefined): MaterializationRuleDirection | undefined => {
  if (strategy === 'advance') {
    return 'advance';
  }
  if (strategy === 'postpone') {
    return 'postpone';
  }
  return undefined;
};

const resolveAdvanceDays = (recurrence: WasteTourRecord['recurrence'], customRecurrenceIntervalDays: number | undefined): number | null => {
  if (recurrence === 'weekly') {
    return 7;
  }
  if (recurrence === 'biweekly') {
    return 14;
  }
  if (recurrence === 'fourweekly') {
    return 28;
  }
  if (recurrence === 'yearly') {
    return 365;
  }
  if (recurrence === 'custom' && typeof customRecurrenceIntervalDays === 'number' && customRecurrenceIntervalDays > 0) {
    return customRecurrenceIntervalDays;
  }
  return null;
};

const getEffectiveYearWindow = (currentYear: number, nextYear: number): readonly number[] => {
  const normalizedCurrentYear = Number.isInteger(currentYear) ? currentYear : new Date().getUTCFullYear();
  const normalizedNextYear = Number.isInteger(nextYear)
    ? nextYear
    : normalizedCurrentYear + MATERIALIZATION_YEAR_OFFSET;
  return [normalizedCurrentYear, normalizedNextYear];
};

const isAllowedByRuleYear = (ruleDate: string, hasYear: boolean, yearWindow: readonly number[]): boolean => {
  if (!hasYear) {
    return true;
  }
  const parsed = parseIsoDateUtc(ruleDate);
  if (!parsed) {
    return false;
  }
  return yearWindow.includes(parsed.getUTCFullYear());
};

const collectRecurrenceDates = (tour: WasteTourRecord, yearWindow: readonly number[]): readonly string[] => {
  const yearSet = new Set(yearWindow);
  const endOfWindow = new Date(`${Math.max(...yearWindow)}-12-31T00:00:00.000Z`);
  const dates = new Set<string>();

  for (const entry of tour.customDates ?? []) {
    if (!isoDatePattern.test(entry.date)) {
      continue;
    }
    const parsed = parseIsoDateUtc(entry.date);
    if (!parsed) {
      continue;
    }
    if (yearSet.has(parsed.getUTCFullYear())) {
      dates.add(entry.date);
    }
  }

  if (!tour.recurrence || tour.recurrence === 'on-demand') {
    return [...dates];
  }

  const step = resolveAdvanceDays(tour.recurrence, tour.customRecurrenceIntervalDays);
  if (step === null) {
    return [...dates];
  }

  const startDate = parseIsoDateUtc(tour.firstDate ?? '');
  if (!startDate) {
    return [...dates];
  }

  const tourEndDate = tour.endDate ? parseIsoDateUtc(tour.endDate) : null;
  const maxEndDate = tourEndDate && tourEndDate < endOfWindow ? tourEndDate : endOfWindow;

  let current = new Date(startDate);
  while (current <= maxEndDate) {
    const entry = toIsoDate(current);
    if (yearSet.has(current.getUTCFullYear())) {
      dates.add(entry);
    }
    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + step);
  }

  return [...dates];
};

const isDateInRange = (date: string, startDate: string | undefined, endDate: string | undefined): boolean => {
  const normalized = parseIsoDateUtc(date);
  if (!normalized) {
    return false;
  }

  const start = startDate ? parseIsoDateUtc(startDate) : null;
  if (start && normalized < start) {
    return false;
  }

  const end = endDate ? parseIsoDateUtc(endDate) : null;
  if (end && normalized > end) {
    return false;
  }

  return true;
};

const getWeekStartIso = (value: string): string | undefined => {
  const date = parseIsoDateUtc(value);
  if (!date) {
    return undefined;
  }
  const weekday = date.getUTCDay();
  const mondayShift = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + mondayShift);
  return toIsoDate(monday);
};

const isSameWeek = (left: string, right: string): boolean => getWeekStartIso(left) === getWeekStartIso(right);

const isDateAffectedByRule = (
  date: string,
  rule: Readonly<
    {
      readonly triggerDate: string;
      readonly direction: MaterializationRuleDirection;
      readonly coverage: MaterializationRuleCoverage;
      readonly shiftDays: number;
    }
  >
): boolean => {
  if (rule.coverage === 'single_pickup') {
    return date === rule.triggerDate;
  }

  if (rule.shiftDays === 0 || !isSameWeek(date, rule.triggerDate)) {
    return false;
  }

  const parsedDate = parseIsoDateUtc(date);
  const parsedTrigger = parseIsoDateUtc(rule.triggerDate);
  if (!parsedDate || !parsedTrigger) {
    return false;
  }

  const dateWeekday = parsedDate.getUTCDay();
  const triggerWeekday = parsedTrigger.getUTCDay();

  return rule.direction === 'postpone'
    ? dateWeekday >= triggerWeekday
    : dateWeekday <= triggerWeekday;
};

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
