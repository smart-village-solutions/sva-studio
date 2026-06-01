import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';

import type {
  WasteManagementSchedulingEntryType,
  WasteManagementSearchParams,
  WasteManagementShiftContext,
} from './search-params.js';

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesShiftContext = (
  search: WasteManagementShiftContext,
  kind: 'holiday' | 'global' | 'tour',
): boolean => search === 'all' || search === kind;

export type WasteSchedulingTableEntry =
  | Readonly<{
      id: string;
      entryType: 'holiday-rule';
      kind: 'holiday';
      originalDate: string;
      actualDate?: undefined;
      contextLabel: string;
      sortLabel: string;
      canDelete: false;
      rule: WasteHolidayRuleRecord;
    }>
  | Readonly<{
      id: string;
      entryType: 'global-shift';
      kind: 'global';
      originalDate: string;
      actualDate: string;
      shift: WasteGlobalDateShiftRecord;
      contextLabel: string;
      sortLabel: string;
      canDelete: true;
    }>
  | Readonly<{
      id: string;
      entryType: 'tour-shift';
      kind: 'tour';
      originalDate: string;
      actualDate: string;
      shift: WasteTourDateShiftRecord;
      contextLabel: string;
      sortLabel: string;
      canDelete: true;
    }>;

const createTourNameMap = (availableTours: readonly WasteTourRecord[]) =>
  new Map(availableTours.map((tour) => [tour.id, tour.name]));

const resolveTourName = (tourNames: ReadonlyMap<string, string>, tourId: string) => tourNames.get(tourId) ?? tourId;

const createHolidayEntry = (rule: WasteHolidayRuleRecord): WasteSchedulingTableEntry => ({
  id: rule.id,
  entryType: 'holiday-rule',
  kind: 'holiday',
  originalDate: rule.holidayDate,
  contextLabel: rule.holidayName,
  sortLabel: rule.holidayName,
  canDelete: false,
  rule,
});

const createGlobalEntry = (
  shift: WasteGlobalDateShiftRecord,
  tourNames: ReadonlyMap<string, string>,
  t: (key: string, variables?: Readonly<Record<string, string | number>>) => string,
): WasteSchedulingTableEntry => {
  const affectedTours = shift.tourIds?.length
    ? shift.tourIds.map((tourId) => resolveTourName(tourNames, tourId)).join(', ')
    : t('scheduling.table.globalContext');

  return {
    id: shift.id,
    entryType: 'global-shift',
    kind: 'global',
    originalDate: shift.originalDate,
    actualDate: shift.actualDate,
    shift,
    contextLabel: affectedTours,
    sortLabel: affectedTours,
    canDelete: true,
  };
};

const createTourEntry = (
  shift: WasteTourDateShiftRecord,
  tourNames: ReadonlyMap<string, string>,
): WasteSchedulingTableEntry => {
  const tourName = resolveTourName(tourNames, shift.tourId);

  return {
    id: shift.id,
    entryType: 'tour-shift',
    kind: 'tour',
    originalDate: shift.originalDate,
    actualDate: shift.actualDate,
    shift,
    contextLabel: tourName,
    sortLabel: tourName,
    canDelete: true,
  };
};

const compareSchedulingEntries = (left: WasteSchedulingTableEntry, right: WasteSchedulingTableEntry) => {
  if (left.originalDate !== right.originalDate) {
    return left.originalDate.localeCompare(right.originalDate);
  }
  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }
  return left.sortLabel.localeCompare(right.sortLabel);
};

const matchesHolidayEntry = (entry: Extract<WasteSchedulingTableEntry, { kind: 'holiday' }>, search: WasteManagementSearchParams) => {
  if (search.tourId) {
    return false;
  }
  if (!search.q) {
    return true;
  }
  return [entry.rule.holidayName, entry.rule.holidayDate, entry.rule.stateCode].some((value) => matchesSearch(value, search.q));
};

const matchesShiftEntry = (
  entry: Extract<WasteSchedulingTableEntry, { kind: 'global' | 'tour' }>,
  search: WasteManagementSearchParams,
) => {
  if (entry.kind === 'global' && search.tourId && !entry.shift.tourIds?.includes(search.tourId)) {
    return false;
  }
  if (entry.kind === 'tour' && search.tourId && entry.shift.tourId !== search.tourId) {
    return false;
  }
  if (!search.q) {
    return true;
  }

  return [
    entry.contextLabel,
    entry.shift.description,
    entry.shift.originalDate,
    entry.shift.actualDate,
    entry.shift.reasonKey,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .some((value) => matchesSearch(value, search.q));
};

export const createSchedulingTableEntries = ({
  holidayRules,
  globalDateShifts,
  tourDateShifts,
  availableTours,
  t,
}: {
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly availableTours: readonly WasteTourRecord[];
  readonly t: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}): readonly WasteSchedulingTableEntry[] => {
  const tourNames = createTourNameMap(availableTours);

  return [
    ...holidayRules.map(createHolidayEntry),
    ...globalDateShifts.map((shift) => createGlobalEntry(shift, tourNames, t)),
    ...tourDateShifts.map((shift) => createTourEntry(shift, tourNames)),
  ].sort(compareSchedulingEntries);
};

export const filterSchedulingTableEntries = (
  entries: readonly WasteSchedulingTableEntry[],
  search: WasteManagementSearchParams,
): readonly WasteSchedulingTableEntry[] =>
  entries.filter((entry) => {
    if (!matchesShiftContext(search.shiftContext, entry.kind)) {
      return false;
    }

    return entry.kind === 'holiday' ? matchesHolidayEntry(entry, search) : matchesShiftEntry(entry, search);
  });

export const findSchedulingTableEntry = ({
  entries,
  schedulingEntryType,
  schedulingEntryId,
}: {
  readonly entries: readonly WasteSchedulingTableEntry[];
  readonly schedulingEntryType?: WasteManagementSchedulingEntryType;
  readonly schedulingEntryId?: string;
}) =>
  entries.find((entry) => entry.entryType === schedulingEntryType && entry.id === schedulingEntryId);
