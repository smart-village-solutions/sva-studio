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

export const createWasteToursTourSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitTour: async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.dialogMode === 'create') {
        await createWasteManagementTour(toCreateTourInput(state.tourForm));
      } else {
        await updateWasteManagementTour(state.tourForm.id, toUpdateTourInput(state.tourForm));
      }
      await loadOverview(true);
      startTransition(() => {
        state.setDialogOpen(false);
        state.setMessage({
          kind: 'success',
          text:
            state.dialogMode === 'create'
              ? pt('tours.messages.createSuccess')
              : pt('tours.messages.updateSuccess'),
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
  },
  onToggleTourStatus: async (tour: WasteTourRecord, nextActive: boolean) => {
    state.setSaving(true);
    state.setMessage(null);
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
  },
  onDeleteTour: async (tour: WasteTourRecord) => {
    state.setSaving(true);
    state.setMessage(null);
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
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.messages.deleteForbidden')
            : code === 'invalid_request'
              ? pt('tours.messages.deleteConflict')
              : pt('tours.messages.deleteError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  onDeleteTours: async (tourIds: readonly string[]) => {
    state.setSaving(true);
    state.setMessage(null);
    try {
      await Promise.all(tourIds.map(async (tourId) => deleteWasteManagementTour(tourId)));
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.deleteSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.messages.deleteForbidden')
            : code === 'invalid_request'
              ? pt('tours.messages.deleteConflict')
              : pt('tours.messages.deleteError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
