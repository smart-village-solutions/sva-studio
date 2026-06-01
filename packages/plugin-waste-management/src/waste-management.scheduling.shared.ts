import type {
  WasteDateShiftReasonType,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftFollowUpMode,
  WasteTourRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementGlobalDateShiftInput,
  CreateWasteManagementTourDateShiftInput,
  UpdateWasteManagementGlobalDateShiftInput,
  UpdateWasteManagementTourDateShiftInput,
} from './waste-management.api.js';
import { compactOptionalString } from './waste-management.page.support.js';
import type {
  WasteManagementSchedulingEntryType,
  WasteManagementSearchParams,
  WasteManagementShiftContext,
} from './search-params.js';

export type TourDateShiftFormState = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType: WasteDateShiftReasonType | '';
  readonly reasonKey: string;
  readonly followUpMode: WasteTourDateShiftFollowUpMode | '';
  readonly description: string;
};

export type GlobalDateShiftFormState = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType: WasteDateShiftReasonType | '';
  readonly reasonKey: string;
  readonly description: string;
  readonly tourIds: readonly string[];
};

const createShiftId = () => crypto.randomUUID();

export const createDefaultTourDateShiftForm = (): TourDateShiftFormState => ({
  id: createShiftId(),
  tourId: '',
  originalDate: '',
  actualDate: '',
  hasYear: true,
  reasonType: '',
  reasonKey: '',
  followUpMode: '',
  description: '',
});

export const createDefaultGlobalDateShiftForm = (): GlobalDateShiftFormState => ({
  id: createShiftId(),
  originalDate: '',
  actualDate: '',
  hasYear: true,
  reasonType: '',
  reasonKey: '',
  description: '',
  tourIds: [],
});

export const mapTourDateShiftToForm = (shift: WasteTourDateShiftRecord): TourDateShiftFormState => ({
  id: shift.id,
  tourId: shift.tourId,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  reasonType: shift.reasonType ?? '',
  reasonKey: shift.reasonKey ?? '',
  followUpMode: shift.followUpMode ?? '',
  description: shift.description ?? '',
});

export const mapGlobalDateShiftToForm = (shift: WasteGlobalDateShiftRecord): GlobalDateShiftFormState => ({
  id: shift.id,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  reasonType: shift.reasonType ?? '',
  reasonKey: shift.reasonKey ?? '',
  description: shift.description ?? '',
  tourIds: shift.tourIds ?? [],
});

export const toCreateTourDateShiftInput = (form: TourDateShiftFormState): CreateWasteManagementTourDateShiftInput => ({
  id: form.id,
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  followUpMode: form.followUpMode || undefined,
  description: compactOptionalString(form.description),
});

export const toUpdateTourDateShiftInput = (form: TourDateShiftFormState): UpdateWasteManagementTourDateShiftInput => ({
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  followUpMode: form.followUpMode || undefined,
  description: compactOptionalString(form.description),
});

export const toCreateGlobalDateShiftInput = (form: GlobalDateShiftFormState): CreateWasteManagementGlobalDateShiftInput => ({
  id: form.id,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

export const toUpdateGlobalDateShiftInput = (form: GlobalDateShiftFormState): UpdateWasteManagementGlobalDateShiftInput => ({
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  reasonType: form.reasonType || undefined,
  reasonKey: compactOptionalString(form.reasonKey),
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesShiftContext = (
  search: WasteManagementShiftContext,
  kind: 'holiday' | 'global' | 'tour'
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

export const resolveSchedulingEntryTypeFromShiftContext = (
  shiftContext: WasteManagementShiftContext,
  availableTours: readonly { readonly id: string }[],
): Exclude<WasteManagementSchedulingEntryType, 'holiday-rule'> => {
  if (shiftContext === 'global') {
    return 'global-shift';
  }
  if (shiftContext === 'tour' && availableTours.length > 0) {
    return 'tour-shift';
  }

  return availableTours.length > 0 ? 'tour-shift' : 'global-shift';
};

export const filterTourDateShifts = (
  shifts: readonly WasteTourDateShiftRecord[],
  search: WasteManagementSearchParams
): readonly WasteTourDateShiftRecord[] =>
  shifts.filter((shift) => {
    if (!matchesShiftContext(search.shiftContext, 'tour')) {
      return false;
    }
    if (search.tourId && shift.tourId !== search.tourId) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [shift.description, shift.originalDate, shift.actualDate, shift.reasonKey]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

export const filterHolidayRules = (
  rules: readonly WasteHolidayRuleRecord[],
  search: WasteManagementSearchParams
): readonly WasteHolidayRuleRecord[] =>
  rules.filter((rule) => {
    if (!matchesShiftContext(search.shiftContext, 'holiday')) {
      return false;
    }
    if (search.tourId) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [rule.holidayName, rule.holidayDate, rule.stateCode].some((value) => matchesSearch(value, search.q));
  });

export const filterGlobalDateShifts = (
  shifts: readonly WasteGlobalDateShiftRecord[],
  search: WasteManagementSearchParams
): readonly WasteGlobalDateShiftRecord[] =>
  shifts.filter((shift) => {
    if (!matchesShiftContext(search.shiftContext, 'global')) {
      return false;
    }
    if (search.tourId && !shift.tourIds?.includes(search.tourId)) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [shift.description, shift.originalDate, shift.actualDate, shift.reasonKey]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

const createTourNameMap = (availableTours: readonly WasteTourRecord[]) =>
  new Map(availableTours.map((tour) => [tour.id, tour.name]));

const resolveTourName = (tourNames: ReadonlyMap<string, string>, tourId: string) => tourNames.get(tourId) ?? tourId;

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
  const holidayEntries: readonly WasteSchedulingTableEntry[] = holidayRules.map((rule) => ({
    id: rule.id,
    entryType: 'holiday-rule',
    kind: 'holiday',
    originalDate: rule.holidayDate,
    contextLabel: rule.holidayName,
    sortLabel: rule.holidayName,
    canDelete: false,
    rule,
  }));
  const globalEntries: readonly WasteSchedulingTableEntry[] = globalDateShifts.map((shift) => {
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
  });
  const tourEntries: readonly WasteSchedulingTableEntry[] = tourDateShifts.map((shift) => {
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
  });

  return [...holidayEntries, ...globalEntries, ...tourEntries].sort((left, right) => {
    if (left.originalDate !== right.originalDate) {
      return left.originalDate.localeCompare(right.originalDate);
    }
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return left.sortLabel.localeCompare(right.sortLabel);
  });
};

export const filterSchedulingTableEntries = (
  entries: readonly WasteSchedulingTableEntry[],
  search: WasteManagementSearchParams
): readonly WasteSchedulingTableEntry[] =>
  entries.filter((entry) => {
    if (!matchesShiftContext(search.shiftContext, entry.kind)) {
      return false;
    }
    if (entry.kind === 'holiday') {
      if (search.tourId) {
        return false;
      }
      if (!search.q) {
        return true;
      }
      return [entry.rule.holidayName, entry.rule.holidayDate, entry.rule.stateCode].some((value) => matchesSearch(value, search.q));
    }

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
