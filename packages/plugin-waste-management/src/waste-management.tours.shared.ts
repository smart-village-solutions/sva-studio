import type {
  WasteCustomTourDate,
  WasteCustomRecurrencePresetRecord,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';

import type {
  CreateWasteManagementLocationTourLinkInput,
  CreateWasteManagementTourInput,
  UpdateWasteManagementLocationTourLinkInput,
  UpdateWasteManagementTourInput,
} from './waste-management.api.js';
import { compactOptionalString } from './waste-management.page.support.js';
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
  status: 'draft',
});

export const mapLocationTourLinkToForm = (
  link: WasteLocationTourLinkRecord
): LocationTourLinkFormState => ({
  id: link.id,
  locationId: link.locationId,
  tourId: link.tourId,
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
  customDates: [...(tour.customDates ?? [])].sort((left, right) =>
    left.date.localeCompare(right.date)
  ),
  dateLocationAssignments: [],
  status: tour.status,
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
}: Pick<TourDateLocationAssignmentFormState, 'pickupDate' | 'locationId'>) =>
  `${pickupDate.trim()}::${locationId.trim()}`;

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

export const toCreateLocationTourLinkInput = (
  form: LocationTourLinkFormState
): CreateWasteManagementLocationTourLinkInput => ({
  id: form.id,
  locationId: form.locationId,
  tourId: form.tourId,
});

export const toUpdateLocationTourLinkInput = (
  form: LocationTourLinkFormState
): UpdateWasteManagementLocationTourLinkInput => ({
  locationId: form.locationId,
  tourId: form.tourId,
});

const normalizeCustomDates = (
  value: TourFormState['customDates']
): CreateWasteManagementTourInput['customDates'] => {
  const entries = [...value]
    .filter((entry) => entry.date.trim().length > 0)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => ({
      date: entry.date.trim(),
      description: compactOptionalString(entry.description ?? ''),
    }));

  return entries.length > 0 ? entries : undefined;
};

const recurringTourRecurrences = new Set<NonNullable<WasteTourRecord['recurrence']>>([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
]);
const customDatesRecurrences = new Set<NonNullable<WasteTourRecord['recurrence']>>(['custom']);
const isRecurringTourRecurrence = (
  recurrence: TourFormState['recurrence']
): recurrence is NonNullable<WasteTourRecord['recurrence']> =>
  recurringTourRecurrences.has(recurrence as NonNullable<WasteTourRecord['recurrence']>);
export const isCustomDatesRecurrence = (
  recurrence: TourFormState['recurrence']
): recurrence is NonNullable<WasteTourRecord['recurrence']> =>
  customDatesRecurrences.has(recurrence as NonNullable<WasteTourRecord['recurrence']>);

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
  !form.customRecurrenceId && isCustomDatesRecurrence(form.recurrence)
    ? normalizeCustomDates(form.customDates)
    : undefined;

export const toCreateTourInput = (
  form: TourFormState,
  duplicateFromTourId?: string
): CreateWasteManagementTourInput => ({
  id: form.id,
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  ...(duplicateFromTourId
    ? { duplicateFromTourId: compactOptionalString(duplicateFromTourId) }
    : {}),
  recurrence: form.customRecurrenceId ? undefined : form.recurrence || undefined,
  customRecurrenceId: compactOptionalString(form.customRecurrenceId),
  ...resolveRecurringDates(form),
  customDates: resolveCustomDates(form),
  status: 'draft',
});

export const toUpdateTourInput = (form: TourFormState): UpdateWasteManagementTourInput => ({
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.customRecurrenceId ? undefined : form.recurrence || undefined,
  customRecurrenceId: compactOptionalString(form.customRecurrenceId),
  ...resolveRecurringDates(form),
  customDates: resolveCustomDates(form),
  status: form.status,
});

export const resolveCustomRecurrencePreset = (
  presets: readonly WasteCustomRecurrencePresetRecord[],
  customRecurrenceId: string
): WasteCustomRecurrencePresetRecord | undefined =>
  presets.find((preset) => preset.id === customRecurrenceId);

export { filterTours, resolveActiveTourFractions } from './waste-management.tours.filter.js';
