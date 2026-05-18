import type {
  WasteDateShiftReasonType,
  WasteGlobalDateShiftRecord,
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
import type { WasteManagementSearchParams } from './search-params.js';

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
  search: WasteManagementSearchParams['shiftContext'],
  kind: 'global' | 'tour'
): boolean => search === 'all' || search === kind;

export type WasteSchedulingTableRow =
  | Readonly<{
      id: string;
      kind: 'global';
      shift: WasteGlobalDateShiftRecord;
      contextLabel: string;
      sortLabel: string;
    }>
  | Readonly<{
      id: string;
      kind: 'tour';
      shift: WasteTourDateShiftRecord;
      contextLabel: string;
      sortLabel: string;
    }>;

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

export const combineSchedulingTableRows = ({
  globalDateShifts,
  tourDateShifts,
  availableTours,
  t,
}: {
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly availableTours: readonly WasteTourRecord[];
  readonly t: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}): readonly WasteSchedulingTableRow[] => {
  const tourNames = createTourNameMap(availableTours);
  const globalRows: readonly WasteSchedulingTableRow[] = globalDateShifts.map((shift) => {
    const affectedTours = shift.tourIds?.length
      ? shift.tourIds.map((tourId) => resolveTourName(tourNames, tourId)).join(', ')
      : t('scheduling.table.globalContext');

    return {
      id: shift.id,
      kind: 'global',
      shift,
      contextLabel: affectedTours,
      sortLabel: affectedTours,
    };
  });
  const tourRows: readonly WasteSchedulingTableRow[] = tourDateShifts.map((shift) => {
    const tourName = resolveTourName(tourNames, shift.tourId);

    return {
      id: shift.id,
      kind: 'tour',
      shift,
      contextLabel: tourName,
      sortLabel: tourName,
    };
  });

  return [...globalRows, ...tourRows].sort((left, right) => {
    if (left.shift.originalDate !== right.shift.originalDate) {
      return left.shift.originalDate.localeCompare(right.shift.originalDate);
    }
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return left.sortLabel.localeCompare(right.sortLabel);
  });
};
