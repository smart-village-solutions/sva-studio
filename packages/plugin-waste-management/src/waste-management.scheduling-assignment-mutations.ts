import { startTransition } from 'react';

import {
  createWasteManagementLocationTourPickupDate,
  createWasteManagementTourAssignment,
  deleteWasteManagementLocationTourPickupDate,
  deleteWasteManagementTourAssignment,
  updateWasteManagementLocationTourPickupDate,
  updateWasteManagementTourAssignment,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingState } from './use-waste-scheduling-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
type HandlerContext = Readonly<{
  state: WasteSchedulingState;
  pt: Translate;
  loadOverview: (active?: boolean) => Promise<void>;
}>;

const resetFeedback = (state: WasteSchedulingState) => {
  state.setSaving(true);
  state.setMessage(null);
  state.setLastOutcome(null);
};

const assignmentError = (pt: Translate, error: unknown, action: 'save' | 'delete') => ({
  kind: 'error' as const,
  text: pt(
    resolveApiErrorCode(error) === 'forbidden'
      ? `scheduling.assignments.messages.${action}Forbidden`
      : `scheduling.assignments.messages.${action}Error`
  ),
});

const createSaveLocationTourPickupDateHandler =
  ({ state, pt, loadOverview }: HandlerContext) =>
  async (
    input: {
      readonly id: string;
      readonly locationId: string;
      readonly tourId: string;
      readonly pickupDate: string;
      readonly note: string;
    },
    mode: 'create' | 'edit'
  ) => {
    resetFeedback(state);
    try {
      if (mode === 'create') await createWasteManagementLocationTourPickupDate(input);
      else {
        await updateWasteManagementLocationTourPickupDate(input.id, {
          locationId: input.locationId,
          tourId: input.tourId,
          pickupDate: input.pickupDate,
          note: input.note,
        });
      }
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt(
            `scheduling.assignments.messages.${mode === 'create' ? 'createSuccess' : 'updateSuccess'}`
          ),
        });
      });
    } catch (error) {
      state.setMessage(assignmentError(pt, error, 'save'));
      throw error;
    } finally {
      state.setSaving(false);
    }
  };

const createSaveTourAssignmentHandler =
  ({ state, pt, loadOverview }: HandlerContext) =>
  async (
    input: {
      readonly id: string;
      readonly tourId: string;
      readonly pickupDate: string;
      readonly note: string;
      readonly locationIds: readonly string[];
    },
    mode: 'create' | 'edit'
  ) => {
    resetFeedback(state);
    try {
      const payload = {
        tourId: input.tourId,
        pickupDate: input.pickupDate,
        note: input.note || undefined,
        locationIds: input.locationIds,
      };
      if (mode === 'create')
        await createWasteManagementTourAssignment({ id: input.id, ...payload });
      else await updateWasteManagementTourAssignment(input.id, payload);
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt(
          `scheduling.assignments.messages.${mode === 'create' ? 'createSuccess' : 'updateSuccess'}`
        ),
      });
    } catch (error) {
      state.setMessage(assignmentError(pt, error, 'save'));
      throw error;
    } finally {
      state.setSaving(false);
    }
  };

const createDeleteAssignmentHandler =
  ({ state, pt, loadOverview }: HandlerContext, deleteAssignment: (id: string) => Promise<unknown>) =>
  async (id: string) => {
    resetFeedback(state);
    try {
      await deleteAssignment(id);
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt('scheduling.assignments.messages.deleteSuccess'),
      });
    } catch (error) {
      state.setMessage(assignmentError(pt, error, 'delete'));
      throw error;
    } finally {
      state.setSaving(false);
    }
  };

export const createWasteSchedulingAssignmentMutationHandlers = (context: HandlerContext) => ({
  onSaveLocationTourPickupDate: createSaveLocationTourPickupDateHandler(context),
  onDeleteLocationTourPickupDate: createDeleteAssignmentHandler(
    context,
    deleteWasteManagementLocationTourPickupDate
  ),
  onSaveTourAssignment: createSaveTourAssignmentHandler(context),
  onDeleteTourAssignment: createDeleteAssignmentHandler(
    context,
    deleteWasteManagementTourAssignment
  ),
});
