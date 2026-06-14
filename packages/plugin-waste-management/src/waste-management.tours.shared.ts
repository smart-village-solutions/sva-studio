import type {
  WasteCustomTourDate,
  WasteCustomRecurrencePresetRecord,
  WasteFractionRecord,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementLocationTourLinkInput,
  CreateWasteManagementTourInput,
  UpdateWasteManagementLocationTourLinkInput,
  UpdateWasteManagementTourInput,
} from './waste-management.api.js';
import { compactOptionalString } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type {
  LocationTourLinkFormState,
  TourDateLocationAssignmentFormState,
  TourFormState,
} from './waste-management.tours.types.js';

const createId = () => crypto.randomUUID();

export const createDefaultLocationTourLinkForm = (): LocationTourLinkFormState => ({
  id: createId(),
  locationId: '',
  tourId: '',
  startDate: '',
  endDate: '',
});

export const createDefaultTourForm = (): TourFormState => ({
  id: createId(),
  name: '',
  description: '',
  wasteFractionIds: [],
  recurrence: 'custom',
  customRecurrenceId: '',
  firstDate: '',
  endDate: '',
  customDates: [],
  dateLocationAssignments: [],
  active: true,
});

export const mapLocationTourLinkToForm = (link: WasteLocationTourLinkRecord): LocationTourLinkFormState => ({
  id: link.id,
  locationId: link.locationId,
  tourId: link.tourId,
  startDate: link.startDate ?? '',
  endDate: link.endDate ?? '',
});

export const mapTourToForm = (tour: WasteTourRecord): TourFormState => ({
  id: tour.id,
  name: tour.name,
  description: tour.description ?? '',
  wasteFractionIds: tour.wasteFractionIds,
  recurrence: tour.customRecurrenceId ? '' : (tour.recurrence ?? 'custom'),
  customRecurrenceId: tour.customRecurrenceId ?? '',
  firstDate: tour.firstDate ?? '',
  endDate: tour.endDate ?? '',
  customDates: [...(tour.customDates ?? [])].sort((left, right) => left.date.localeCompare(right.date)),
  dateLocationAssignments: [],
  active: tour.active,
});

export const mapTourWithPickupDatesToForm = (
  tour: WasteTourRecord,
  pickupDates: readonly WasteLocationTourPickupDateRecord[]
): TourFormState => ({
  ...mapTourToForm(tour),
  dateLocationAssignments: mapPickupDatesToTourDateLocationAssignments(pickupDates, tour.id),
});

const normalizeAssignmentNote = (value: string): string => compactOptionalString(value) ?? '';

export const createTourDateLocationAssignmentKey = ({
  pickupDate,
  locationId,
}: Pick<TourDateLocationAssignmentFormState, 'pickupDate' | 'locationId'>) => `${pickupDate.trim()}::${locationId.trim()}`;

export const sortTourDateLocationAssignments = (
  assignments: readonly TourDateLocationAssignmentFormState[]
): readonly TourDateLocationAssignmentFormState[] =>
  [...assignments].sort((left, right) => {
    const dateComparison = left.pickupDate.localeCompare(right.pickupDate);
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return left.locationId.localeCompare(right.locationId);
  });

export const removeAssignmentsForDeletedDates = (
  assignments: readonly TourDateLocationAssignmentFormState[],
  customDates: readonly WasteCustomTourDate[]
): readonly TourDateLocationAssignmentFormState[] => {
  const validDates = new Set(customDates.map((entry) => entry.date));
  return assignments.filter((assignment) => validDates.has(assignment.pickupDate));
};

export const mapPickupDatesToTourDateLocationAssignments = (
  pickupDates: readonly WasteLocationTourPickupDateRecord[],
  tourId: string
): readonly TourDateLocationAssignmentFormState[] =>
  sortTourDateLocationAssignments(
    pickupDates
      .filter((entry) => entry.tourId === tourId)
      .map((entry) => ({
        id: entry.id,
        pickupDate: entry.pickupDate,
        locationId: entry.locationId,
        note: entry.note ?? '',
      }))
  );

export const normalizeTourDateLocationAssignments = (
  assignments: readonly TourDateLocationAssignmentFormState[]
): readonly TourDateLocationAssignmentFormState[] => {
  const byKey = new Map<string, TourDateLocationAssignmentFormState>();

  for (const assignment of assignments) {
    const pickupDate = assignment.pickupDate.trim();
    const locationId = assignment.locationId.trim();

    if (pickupDate.length === 0 || locationId.length === 0) {
      continue;
    }

    const nextAssignment = {
      ...assignment,
      pickupDate,
      locationId,
      note: normalizeAssignmentNote(assignment.note),
    };

    byKey.set(createTourDateLocationAssignmentKey(nextAssignment), nextAssignment);
  }

  return sortTourDateLocationAssignments([...byKey.values()]);
};

export const toCreateLocationTourLinkInput = (form: LocationTourLinkFormState): CreateWasteManagementLocationTourLinkInput => ({
  id: form.id,
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

export const toUpdateLocationTourLinkInput = (form: LocationTourLinkFormState): UpdateWasteManagementLocationTourLinkInput => ({
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

const normalizeCustomDates = (value: TourFormState['customDates']): CreateWasteManagementTourInput['customDates'] => {
  const entries = [...value]
    .filter((entry) => entry.date.trim().length > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => ({
      date: entry.date.trim(),
      description: compactOptionalString(entry.description ?? ''),
    }));

  return entries.length > 0 ? entries : undefined;
};

const recurringTourRecurrences = new Set<NonNullable<WasteTourRecord['recurrence']>>(['weekly', 'biweekly', 'fourweekly', 'yearly']);
const customDatesRecurrences = new Set<NonNullable<WasteTourRecord['recurrence']>>(['custom']);
const isRecurringTourRecurrence = (
  recurrence: TourFormState['recurrence']
): recurrence is NonNullable<WasteTourRecord['recurrence']> => recurringTourRecurrences.has(recurrence as NonNullable<WasteTourRecord['recurrence']>);
const isCustomDatesRecurrence = (
  recurrence: TourFormState['recurrence']
): recurrence is NonNullable<WasteTourRecord['recurrence']> => customDatesRecurrences.has(recurrence as NonNullable<WasteTourRecord['recurrence']>);

const resolveRecurringDates = (form: TourFormState) =>
  form.customRecurrenceId || isRecurringTourRecurrence(form.recurrence)
    ? {
        firstDate: compactOptionalString(form.firstDate),
        endDate: compactOptionalString(form.endDate),
      }
    : {
        firstDate: undefined,
        endDate: undefined,
      };

const resolveCustomDates = (form: TourFormState) =>
  !form.customRecurrenceId && isCustomDatesRecurrence(form.recurrence) ? normalizeCustomDates(form.customDates) : undefined;

export const toCreateTourInput = (form: TourFormState, duplicateFromTourId?: string): CreateWasteManagementTourInput => ({
  id: form.id,
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  duplicateFromTourId: duplicateFromTourId ? compactOptionalString(duplicateFromTourId) : undefined,
  recurrence: form.customRecurrenceId ? undefined : (form.recurrence || undefined),
  customRecurrenceId: compactOptionalString(form.customRecurrenceId),
  ...resolveRecurringDates(form),
  customDates: resolveCustomDates(form),
  active: form.active,
});

export const toUpdateTourInput = (form: TourFormState): UpdateWasteManagementTourInput => ({
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.customRecurrenceId ? undefined : (form.recurrence || undefined),
  customRecurrenceId: compactOptionalString(form.customRecurrenceId),
  ...resolveRecurringDates(form),
  customDates: resolveCustomDates(form),
  active: form.active,
});

export const resolveCustomRecurrencePreset = (
  presets: readonly WasteCustomRecurrencePresetRecord[],
  customRecurrenceId: string
): WasteCustomRecurrencePresetRecord | undefined => presets.find((preset) => preset.id === customRecurrenceId);

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesStatusFilter = (status: WasteManagementSearchParams['status'], active: boolean | undefined): boolean => {
  if (status === 'all' || active === undefined) {
    return true;
  }
  return status === 'active' ? active : !active;
};

const matchesDateLowerBound = (value: string | null | undefined, lowerBound: string | undefined): boolean => {
  if (!lowerBound) {
    return true;
  }
  return typeof value === 'string' && value >= lowerBound;
};

const matchesDateUpperBound = (value: string | null | undefined, upperBound: string | undefined): boolean => {
  if (!upperBound) {
    return true;
  }
  return typeof value === 'string' && value <= upperBound;
};

export const filterTours = (
  tours: readonly WasteTourRecord[],
  search: WasteManagementSearchParams
): readonly WasteTourRecord[] =>
  tours.filter((tour) => {
    if (search.tourId && tour.id !== search.tourId) {
      return false;
    }
    if (!matchesStatusFilter(search.status, tour.active)) {
      return false;
    }
    if (search.tourWasteFractionId && !tour.wasteFractionIds.includes(search.tourWasteFractionId)) {
      return false;
    }
    if (!matchesDateLowerBound(tour.firstDate, search.firstDateFrom)) {
      return false;
    }
    if (!matchesDateUpperBound(tour.firstDate, search.firstDateTo)) {
      return false;
    }
    if (!matchesDateLowerBound(tour.endDate, search.endDateFrom)) {
      return false;
    }
    if (!matchesDateUpperBound(tour.endDate, search.endDateTo)) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [tour.name, tour.description]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

export const resolveActiveTourFractions = (
  fractions: readonly WasteFractionRecord[],
  ids: readonly string[]
): readonly WasteFractionRecord[] => fractions.filter((fraction) => ids.includes(fraction.id));
