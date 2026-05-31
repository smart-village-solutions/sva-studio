import { startTransition, type FormEvent } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import {
  createWasteManagementTour,
  deleteWasteManagementTour,
  updateWasteManagementTour,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { mapTourToForm, toCreateTourInput, toUpdateTourInput } from './waste-management.tours.shared.js';
import type { WasteToursState } from './waste-management.tours.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

type WasteToursSubmissionContext = {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
};

const setDeleteErrorMessage = (state: WasteToursState, pt: Translate, error: unknown) => {
  const code = resolveApiErrorCode(error);
  state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? pt('tours.messages.deleteForbidden')
        : code === 'invalid_request'
          ? pt('tours.messages.deleteConflict')
          : pt('tours.messages.deleteError'),
  });
};

const createSubmitTourHandler = ({ state, pt, loadOverview }: WasteToursSubmissionContext) => async (
  event: FormEvent<HTMLFormElement>,
  mode = state.dialogMode,
  duplicateFromTourId?: string,
) => {
  event.preventDefault();
  state.setSaving(true);
  state.setMessage(null);
  state.setLastOutcome(null);
  try {
    if (mode === 'create') {
      await createWasteManagementTour(toCreateTourInput(state.tourForm, duplicateFromTourId));
    } else {
      await updateWasteManagementTour(state.tourForm.id, toUpdateTourInput(state.tourForm));
    }
    await loadOverview(true);
    startTransition(() => {
      state.setDialogOpen(false);
      state.setLastOutcome(mode === 'create' ? 'create-success' : 'update-success');
      state.setMessage({
        kind: 'success',
        text: mode === 'create' ? pt('tours.messages.createSuccess') : pt('tours.messages.updateSuccess'),
      });
    });
  } catch (saveError) {
    const code = resolveApiErrorCode(saveError);
    state.setMessage({
      kind: 'error',
      text: code === 'forbidden' ? pt('tours.messages.saveForbidden') : pt('tours.messages.saveError'),
    });
  } finally {
    state.setSaving(false);
  }
};

const createToggleTourStatusHandler = ({ state, pt, loadOverview }: WasteToursSubmissionContext) => async (
  tour: WasteTourRecord,
  nextActive: boolean
) => {
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
      text: code === 'forbidden' ? pt('tours.messages.saveForbidden') : pt('tours.messages.saveError'),
    });
  } finally {
    state.setSaving(false);
  }
};

const createDeleteTourHandler = ({ state, pt, loadOverview }: WasteToursSubmissionContext) => async (tour: WasteTourRecord) => {
  state.setSaving(true);
  state.setMessage(null);
  state.setLastOutcome(null);
  try {
    await deleteWasteManagementTour(tour.id);
    await loadOverview(true);
    startTransition(() => {
      state.setMessage({
        kind: 'success',
        text: pt('tours.messages.deleteSuccess'),
      });
    });
  } catch (saveError) {
    setDeleteErrorMessage(state, pt, saveError);
  } finally {
    state.setSaving(false);
  }
};

const createDeleteToursHandler = ({ state, pt, loadOverview }: WasteToursSubmissionContext) => async (
  tourIds: readonly string[]
) => {
  state.setSaving(true);
  state.setMessage(null);
  state.setLastOutcome(null);
  try {
    const results = await Promise.allSettled(tourIds.map(async (tourId) => deleteWasteManagementTour(tourId)));
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

    setDeleteErrorMessage(state, pt, failedResults[0]?.reason);
  } catch (saveError) {
    setDeleteErrorMessage(state, pt, saveError);
  } finally {
    state.setSaving(false);
  }
};

export const createWasteToursTourSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: WasteToursSubmissionContext) => ({
  onSubmitTour: createSubmitTourHandler({ state, pt, loadOverview }),
  onToggleTourStatus: createToggleTourStatusHandler({ state, pt, loadOverview }),
  onDeleteTour: createDeleteTourHandler({ state, pt, loadOverview }),
  onDeleteTours: createDeleteToursHandler({ state, pt, loadOverview }),
});
