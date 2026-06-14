import { startTransition, type FormEvent } from 'react';

import {
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
  updateWasteManagementLocationTourLink,
} from './waste-management.api.js';
import { submitWasteLocationTourLinksBulkInChunks } from './waste-management.location-tour-links-bulk-client.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { toCreateLocationTourLinkInput, toUpdateLocationTourLinkInput } from './waste-management.tours.shared.js';
import type { WasteToursState } from './use-waste-tours-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

type AssignmentMutationContext = {
  readonly state: WasteToursState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
};

type AssignmentChangeSet = {
  readonly tourId: string;
  readonly currentLinks: readonly { readonly id: string; readonly locationId: string; readonly tourId: string }[];
  readonly uniqueSelectedLocationIds: readonly string[];
  readonly linksToDelete: readonly { readonly id: string; readonly locationId: string; readonly tourId: string }[];
  readonly locationIdsToCreate: readonly string[];
};

const toCreateLocationTourInput = toCreateLocationTourLinkInput;
const toUpdateLocationTourInput = toUpdateLocationTourLinkInput;

const getTourId = (state: WasteToursState) => state.selectedTour?.id ?? state.linkForm.tourId.trim();

const getUniqueSelectedLocationIds = (selectedLocationIds: readonly string[]) =>
  Array.from(
    new Set(selectedLocationIds.map((locationId) => locationId.trim()).filter((locationId) => locationId.length > 0))
  );

const resolveAssignmentChangeSet = (
  state: WasteToursState,
  selectedLocationIds: readonly string[],
  tourId: string
): AssignmentChangeSet => {
  const currentLinks = (state.masterDataOverview?.locationTourLinks ?? []).filter((link) => link.tourId === tourId);
  const currentLinkByLocationId = new Map(currentLinks.map((link) => [link.locationId, link] as const));
  const uniqueSelectedLocationIds = getUniqueSelectedLocationIds(selectedLocationIds);
  const selectedLocationIdSet = new Set(uniqueSelectedLocationIds);

  return {
    tourId,
    currentLinks,
    uniqueSelectedLocationIds,
    linksToDelete: currentLinks.filter((link) => !selectedLocationIdSet.has(link.locationId)),
    locationIdsToCreate: uniqueSelectedLocationIds.filter((locationId) => !currentLinkByLocationId.has(locationId)),
  };
};

const createSingleAssignment = async (state: WasteToursState, selectedLocationIds: readonly string[], tourId: string) => {
  const locationId = getUniqueSelectedLocationIds(selectedLocationIds)[0] ?? state.linkForm.locationId.trim();
  if (!locationId) {
    return;
  }

  await createWasteManagementLocationTourLink(
    toCreateLocationTourInput({
      ...state.linkForm,
      locationId,
      tourId,
    })
  );
};

const createBulkAssignments = async (state: WasteToursState, changeSet: AssignmentChangeSet) => {
  if (changeSet.locationIdsToCreate.length === 0) {
    return;
  }

  await submitWasteLocationTourLinksBulkInChunks(
    wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput(
      {
        tourId: changeSet.tourId,
        startDate: state.linkForm.startDate,
        endDate: state.linkForm.endDate,
      },
      changeSet.locationIdsToCreate
    ),
    createWasteManagementLocationTourLinksBulk
  );
};

const deleteRemovedAssignments = async (linksToDelete: AssignmentChangeSet['linksToDelete']) => {
  if (linksToDelete.length === 0) {
    return;
  }

  await Promise.all(linksToDelete.map((link) => deleteWasteManagementLocationTourLink(link.id)));
};

const updateEditedAssignment = async (state: WasteToursState, changeSet: AssignmentChangeSet) => {
  if (
    changeSet.locationIdsToCreate.length > 0 ||
    changeSet.linksToDelete.length > 0 ||
    state.assignmentsDialogMode !== 'edit' ||
    state.linkForm.id.trim().length === 0
  ) {
    return;
  }

  await updateWasteManagementLocationTourLink(
    state.linkForm.id,
    toUpdateLocationTourInput({
      ...state.linkForm,
      tourId: changeSet.tourId,
    })
  );
};

const resolveSuccessMessage = (pt: Translate, mode: WasteToursState['assignmentsDialogMode'], currentLinksCount: number) =>
  mode === 'create' && currentLinksCount === 0
    ? pt('tours.assignments.messages.createSuccess')
    : pt('tours.assignments.messages.updateSuccess');

const finalizeAssignmentSuccess = (
  state: WasteToursState,
  pt: Translate,
  mode: WasteToursState['assignmentsDialogMode'],
  currentLinksCount: number
) => {
  startTransition(() => {
    state.setAssignmentsDialogOpen(false);
    state.setMessage({
      kind: 'success',
      text: resolveSuccessMessage(pt, mode, currentLinksCount),
    });
  });
};

export const createToursAssignmentSubmitHandler = (context: AssignmentMutationContext) => async (
  event: FormEvent<HTMLFormElement>,
  selectedLocationIds: readonly string[]
) => {
  event.preventDefault();
  context.state.setSaving(true);
  context.state.setMessage(null);
  try {
    const tourId = getTourId(context.state);
    if (!tourId) {
      context.state.setMessage({
        kind: 'error',
        text: context.pt('tours.assignments.messages.saveError'),
      });
      return;
    }

    const changeSet = resolveAssignmentChangeSet(context.state, selectedLocationIds, tourId);
    if (context.state.assignmentsDialogMode === 'create' && changeSet.uniqueSelectedLocationIds.length <= 1) {
      await createSingleAssignment(context.state, selectedLocationIds, tourId);
    } else {
      await createBulkAssignments(context.state, changeSet);
      await deleteRemovedAssignments(changeSet.linksToDelete);
      await updateEditedAssignment(context.state, changeSet);
    }

    await context.loadOverview(true);
    finalizeAssignmentSuccess(
      context.state,
      context.pt,
      context.state.assignmentsDialogMode,
      changeSet.currentLinks.length
    );
  } catch (saveError) {
    const code = resolveApiErrorCode(saveError);
    context.state.setMessage({
      kind: 'error',
      text:
        code === 'forbidden'
          ? context.pt('tours.assignments.messages.saveForbidden')
          : context.pt('tours.assignments.messages.saveError'),
    });
  } finally {
    context.state.setSaving(false);
  }
};
