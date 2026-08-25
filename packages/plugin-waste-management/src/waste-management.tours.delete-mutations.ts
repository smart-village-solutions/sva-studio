import { startTransition } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { deleteWasteManagementTour } from './waste-management.api.js';
import {
  logWasteTourDeleteError,
  logWasteTourDeleteStart,
  logWasteTourDeleteSuccess,
} from './waste-management.tours.delete-debug.js';
import { throwTourDeleteError } from './waste-management.tours.messages.js';
import type { WasteToursSubmissionContext } from './waste-management.tours.mutation-context.js';

const refreshAfterDelete = async ({ state, pt, loadOverview }: WasteToursSubmissionContext) => {
  try {
    await loadOverview(true);
    return true;
  } catch {
    state.setMessage({
      kind: 'warning',
      text: pt('tours.messages.refreshAfterDeleteError'),
    });
    return false;
  }
};

const createDeleteTourHandler =
  (context: WasteToursSubmissionContext) => async (tour: WasteTourRecord) => {
    const { state, pt } = context;
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      try {
        logWasteTourDeleteStart(tour);
        await deleteWasteManagementTour(tour.id);
        logWasteTourDeleteSuccess(tour);
      } catch (saveError) {
        logWasteTourDeleteError(tour, saveError);
        throwTourDeleteError(state, pt, saveError);
      }
      if (!(await refreshAfterDelete(context))) return;
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.deleteSuccess'),
        });
      });
    } finally {
      state.setSaving(false);
    }
  };

const createDeleteToursHandler =
  (context: WasteToursSubmissionContext) => async (tourIds: readonly string[]) => {
    const { state, pt } = context;
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const results = await Promise.allSettled(
        tourIds.map(async (tourId) => deleteWasteManagementTour(tourId))
      );
      const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedResults = results.filter((result) => result.status === 'rejected');

      if (deletedCount > 0 && !(await refreshAfterDelete(context))) return;

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

export const createWasteToursDeleteMutationHandlers = (context: WasteToursSubmissionContext) => ({
  onDeleteTour: createDeleteTourHandler(context),
  onDeleteTours: createDeleteToursHandler(context),
});
