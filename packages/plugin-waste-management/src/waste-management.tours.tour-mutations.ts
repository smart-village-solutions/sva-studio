import { startTransition, type FormEvent } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import {
  createWasteManagementTour,
  createWasteManagementLocationTourPickupDate,
  deleteWasteManagementLocationTourPickupDate,
  deleteWasteManagementTour,
  updateWasteManagementLocationTourPickupDate,
  updateWasteManagementTour,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import {
  logWasteTourDeleteError,
  logWasteTourDeleteStart,
  logWasteTourDeleteSuccess,
} from './waste-management.tours.delete-debug.js';
import { throwTourDeleteError } from './waste-management.tours.messages.js';
import {
  createTourDateLocationAssignmentKey,
  isCustomDatesRecurrence,
  mapTourToForm,
  normalizeTourDateLocationAssignments,
  toCreateTourInput,
  toUpdateTourInput,
} from './waste-management.tours.shared.js';
import { createUpdateTourValidityBulkHandler } from './waste-management.tours.validity-mutation.js';
import {
  validateTourAssignments,
  type WasteToursSubmissionContext,
} from './waste-management.tours.mutation-context.js';
import type { WasteToursState } from './use-waste-tours-state.js';

export type { WasteToursSubmissionContext } from './waste-management.tours.mutation-context.js';

const reconcileTourDateLocationAssignments = async ({
  state,
  tourId,
}: {
  readonly state: WasteToursState;
  readonly tourId: string;
}) => {
  const existingAssignments = (state.schedulingOverview?.locationTourPickupDates ?? []).filter(
    (entry) => entry.tourId === tourId
  );
  const normalizedAssignments = isCustomDatesRecurrence(state.tourForm.recurrence)
    ? normalizeTourDateLocationAssignments(
        state.tourForm.dateLocationAssignments.filter((entry) => entry.pickupDate.length > 0)
      )
    : [];

  const existingByKey = new Map(
    existingAssignments.map((entry) => [createTourDateLocationAssignmentKey(entry), entry])
  );
  const nextByKey = new Map(
    normalizedAssignments.map((entry) => [createTourDateLocationAssignmentKey(entry), entry])
  );

  const createOperations = normalizedAssignments
    .filter((entry) => !existingByKey.has(createTourDateLocationAssignmentKey(entry)))
    .map((entry) =>
      createWasteManagementLocationTourPickupDate({
        id: entry.id,
        locationId: entry.locationId,
        tourId,
        pickupDate: entry.pickupDate,
        note: entry.note,
      })
    );

  const updateOperations = normalizedAssignments.flatMap((entry) => {
    const existing = existingByKey.get(createTourDateLocationAssignmentKey(entry));
    if (!existing || (existing.note ?? '') === entry.note) {
      return [];
    }

    return [
      updateWasteManagementLocationTourPickupDate(existing.id, {
        locationId: entry.locationId,
        tourId,
        pickupDate: entry.pickupDate,
        note: entry.note,
      }),
    ];
  });

  const deleteOperations = existingAssignments.flatMap((entry) =>
    nextByKey.has(createTourDateLocationAssignmentKey(entry))
      ? []
      : [deleteWasteManagementLocationTourPickupDate(entry.id)]
  );

  await Promise.all([...createOperations, ...updateOperations, ...deleteOperations]);
};

const createSubmitTourHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (
    event: FormEvent<HTMLFormElement>,
    mode = state.dialogMode,
    duplicateFromTourId?: string
  ) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      if (!validateTourAssignments(state, pt)) {
        return;
      }
      if (mode === 'create') {
        await createWasteManagementTour(toCreateTourInput(state.tourForm, duplicateFromTourId));
      } else {
        await updateWasteManagementTour(state.tourForm.id, toUpdateTourInput(state.tourForm));
      }
      await reconcileTourDateLocationAssignments({ state, tourId: state.tourForm.id });
      await loadOverview(true);
      startTransition(() => {
        state.setDialogOpen(false);
        state.setLastOutcome(mode === 'create' ? 'create-success' : 'update-success');
        state.setMessage({
          kind: 'success',
          text:
            mode === 'create'
              ? pt('tours.messages.createSuccess')
              : pt('tours.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.messages.saveForbidden')
            : pt('tours.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  };

const createToggleTourStatusHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (tour: WasteTourRecord, nextActive: boolean) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const nextForm = {
        ...mapTourToForm(tour),
        active: nextActive,
      };
      await updateWasteManagementTour(tour.id, toUpdateTourInput(nextForm));
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.messages.saveForbidden')
            : pt('tours.messages.saveError'),
      });
      throw saveError;
    } finally {
      state.setSaving(false);
    }
  };

const createDeleteTourHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (tour: WasteTourRecord) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      logWasteTourDeleteStart(tour);
      await deleteWasteManagementTour(tour.id);
      logWasteTourDeleteSuccess(tour);
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.deleteSuccess'),
        });
      });
    } catch (saveError) {
      logWasteTourDeleteError(tour, saveError);
      throwTourDeleteError(state, pt, saveError);
    } finally {
      state.setSaving(false);
    }
  };

const createDeleteToursHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (tourIds: readonly string[]) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const results = await Promise.allSettled(
        tourIds.map(async (tourId) => deleteWasteManagementTour(tourId))
      );
      const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedResults = results.filter((result) => result.status === 'rejected');

      if (deletedCount > 0) {
        await loadOverview(true);
      }

      if (failedResults.length === 0) {
        startTransition(() => {
          state.setMessage({
            kind: 'success',
            text: pt('tours.messages.deleteSuccess'),
          });
        });
        return;
      }

      if (deletedCount > 0) {
        startTransition(() => {
          state.setMessage({
            kind: 'success',
            text: pt('tours.messages.deletePartialSuccess', {
              count: deletedCount,
              total: tourIds.length,
            }),
          });
        });
        return;
      }

      throw failedResults[0]?.reason;
    } catch (saveError) {
      throwTourDeleteError(state, pt, saveError);
    } finally {
      state.setSaving(false);
    }
  };

export const createWasteToursTourMutationHandlers = ({
  state,
  pt,
  loadOverview,
}: WasteToursSubmissionContext) => ({
  onSubmitTour: createSubmitTourHandler({ state, pt, loadOverview }),
  onToggleTourStatus: createToggleTourStatusHandler({ state, pt, loadOverview }),
  onDeleteTour: createDeleteTourHandler({ state, pt, loadOverview }),
  onDeleteTours: createDeleteToursHandler({ state, pt, loadOverview }),
  onUpdateTourValidityBulk: createUpdateTourValidityBulkHandler({ state, pt, loadOverview }),
});
