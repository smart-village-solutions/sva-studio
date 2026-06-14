import { startTransition, type FormEvent } from 'react';

import {
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
  updateWasteManagementLocationTourLink,
} from './waste-management.api.js';
import { submitWasteLocationTourLinksBulkInChunks } from './waste-management.location-tour-links-bulk-client.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { toCreateLocationTourLinkInput, toUpdateLocationTourLinkInput } from './waste-management.tours.shared.js';
import type { WasteToursState } from './use-waste-tours-state.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToursAssignmentMutationHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitAssignments: async (event: FormEvent<HTMLFormElement>, selectedLocationIds: readonly string[]) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      const tourId = state.selectedTour?.id ?? state.linkForm.tourId.trim();
      if (!tourId) {
        state.setMessage({
          kind: 'error',
          text: pt('tours.assignments.messages.saveError'),
        });
        return;
      }

      const currentLinks = (state.masterDataOverview?.locationTourLinks ?? []).filter((link) => link.tourId === tourId);
      const currentLinkByLocationId = new Map(currentLinks.map((link) => [link.locationId, link] as const));
      const uniqueSelectedLocationIds = Array.from(
        new Set(selectedLocationIds.map((locationId) => locationId.trim()).filter((locationId) => locationId.length > 0))
      );
      const selectedLocationIdSet = new Set(uniqueSelectedLocationIds);
      const linksToDelete = currentLinks.filter((link) => !selectedLocationIdSet.has(link.locationId));
      const locationIdsToCreate = uniqueSelectedLocationIds.filter((locationId) => !currentLinkByLocationId.has(locationId));

      if (state.assignmentsDialogMode === 'create' && uniqueSelectedLocationIds.length <= 1) {
        const locationId = uniqueSelectedLocationIds[0] ?? state.linkForm.locationId.trim();
        if (locationId) {
          await createWasteManagementLocationTourLink(
            toCreateLocationTourInput({
              ...state.linkForm,
              locationId,
              tourId,
            })
          );
        }
      } else {
        if (locationIdsToCreate.length > 0) {
          await submitWasteLocationTourLinksBulkInChunks(
            wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput(
              {
                tourId,
                startDate: state.linkForm.startDate,
                endDate: state.linkForm.endDate,
              },
              locationIdsToCreate
            ),
            createWasteManagementLocationTourLinksBulk
          );
        }

        if (linksToDelete.length > 0) {
          await Promise.all(linksToDelete.map((link) => deleteWasteManagementLocationTourLink(link.id)));
        }

        if (
          locationIdsToCreate.length === 0 &&
          linksToDelete.length === 0 &&
          state.assignmentsDialogMode === 'edit' &&
          state.linkForm.id.trim().length > 0
        ) {
          await updateWasteManagementLocationTourLink(
            state.linkForm.id,
            toUpdateLocationTourInput({
              ...state.linkForm,
              tourId,
            })
          );
        }
      }
      await loadOverview(true);
      startTransition(() => {
        state.setAssignmentsDialogOpen(false);
        state.setMessage({
          kind: 'success',
          text:
            state.assignmentsDialogMode === 'create' && currentLinks.length === 0
              ? pt('tours.assignments.messages.createSuccess')
              : pt('tours.assignments.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.assignments.messages.saveForbidden')
            : pt('tours.assignments.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});

const toCreateLocationTourInput = toCreateLocationTourLinkInput;
const toUpdateLocationTourInput = toUpdateLocationTourLinkInput;
