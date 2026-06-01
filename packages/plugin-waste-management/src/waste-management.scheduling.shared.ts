import type {
  WasteDateShiftReasonType,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftFollowUpMode,
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
export type { WasteSchedulingTableEntry } from './waste-management.scheduling.table-entries.js';
export {
  createSchedulingTableEntries,
  filterSchedulingTableEntries,
  findSchedulingTableEntry,
} from './waste-management.scheduling.table-entries.js';

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesShiftContext = (
  search: WasteManagementShiftContext,
  kind: 'holiday' | 'global' | 'tour',
): boolean => search === 'all' || search === kind;

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
