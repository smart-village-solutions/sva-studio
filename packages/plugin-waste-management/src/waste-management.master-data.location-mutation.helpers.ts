import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCollectionLocation,
  deleteWasteManagementCollectionLocation,
  createWasteManagementLocationTourLinksBulk,
  updateWasteManagementCollectionLocation,
  WasteManagementApiError,
} from './waste-management.api.js';
import { submitWasteLocationTourLinksBulkInChunks } from './waste-management.location-tour-links-bulk-client.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess, type WasteMasterDataState } from './use-waste-master-data-state.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

type LocationMutationContext = {
  readonly state: WasteMasterDataState;
  readonly pt: Translate;
  readonly search: WasteManagementSearchParams;
  readonly loadOverview: (active?: boolean) => Promise<void>;
  readonly selectedCollectionLocationIds: readonly string[];
};

const resolveLocationMode = (state: WasteMasterDataState, search: WasteManagementSearchParams) =>
  search.locationsView === 'edit' ? 'edit' : state.locationDialogMode;

const resolveLocationSaveErrorMessage = (error: unknown, pt: Translate) => {
  const code = resolveApiErrorCode(error);
  if (code === 'forbidden') {
    return pt('masterData.collectionLocations.messages.saveForbidden');
  }
  if (error instanceof WasteManagementApiError && error.message.length > 0 && error.message !== error.code) {
    return pt('masterData.collectionLocations.messages.saveErrorWithReason', { reason: error.message });
  }
  return pt('masterData.collectionLocations.messages.saveError');
};

const runDeleteMessage = (pt: Translate, code: string | null | undefined, bulk: boolean) => {
  const messageKeyPrefix = bulk
    ? 'masterData.collectionLocations.bulk.messages'
    : 'masterData.collectionLocations.messages';
  if (code === 'forbidden') {
    return pt(`${messageKeyPrefix}.deleteForbidden`);
  }
  if (code === 'conflict') {
    return pt(`${messageKeyPrefix}.deleteConflict`);
  }
  return pt(`${messageKeyPrefix}.deleteError`);
};

const runLocationSave = async (
  submittedForm: CollectionLocationFormState,
  mode: 'create' | 'edit',
  context: LocationMutationContext
) => {
  if (mode === 'create') {
    await createWasteManagementCollectionLocation(
      wasteMasterDataInputMappers.toCreateCollectionLocationInput(submittedForm)
    );
    return;
  }

  await updateWasteManagementCollectionLocation(
    submittedForm.id,
    wasteMasterDataInputMappers.toUpdateCollectionLocationInput(submittedForm)
  );
};

export const createLocationSubmitHandler = (context: LocationMutationContext) => async (
  submittedForm: CollectionLocationFormState,
  mode = resolveLocationMode(context.state, context.search)
) => {
  context.state.setSaving(true);
  context.state.setMessage(null);
  context.state.setLastOutcome(null);
  try {
    await runLocationSave(submittedForm, mode, context);
    await context.loadOverview(true);
    applySuccess(
      () => context.state.setLocationDialogOpen(false),
      context.state.setMessage,
      mode === 'create'
        ? context.pt('masterData.collectionLocations.messages.createSuccess')
        : context.pt('masterData.collectionLocations.messages.updateSuccess'),
      () =>
        context.state.setLastOutcome(mode === 'create' ? 'location-create-success' : 'location-update-success')
    );
  } catch (saveError) {
    context.state.setMessage({
      kind: 'error',
      text: resolveLocationSaveErrorMessage(saveError, context.pt),
    });
  } finally {
    context.state.setSaving(false);
  }
};

export const createLocationDeleteHandler = (context: LocationMutationContext) => async (location: { readonly id: string }) => {
  context.state.setSaving(true);
  context.state.setMessage(null);
  context.state.setLastOutcome(null);
  try {
    await deleteWasteManagementCollectionLocation(location.id);
    await context.loadOverview(true);
    context.state.setSelectedLocationIds((current) => current.filter((selectedId) => selectedId !== location.id));
    context.state.setMessage({
      kind: 'success',
      text: context.pt('masterData.collectionLocations.messages.deleteSuccess'),
    });
  } catch (deleteError) {
    context.state.setMessage({
      kind: 'error',
      text: runDeleteMessage(context.pt, resolveApiErrorCode(deleteError), false),
    });
  } finally {
    context.state.setSaving(false);
  }
};

export const createLocationsBulkDeleteHandler = (context: LocationMutationContext) => async (
  locationIds: readonly string[]
) => {
  context.state.setSaving(true);
  context.state.setMessage(null);
  context.state.setLastOutcome(null);
  try {
    for (const locationId of locationIds) {
      await deleteWasteManagementCollectionLocation(locationId);
    }
    await context.loadOverview(true);
    context.state.setSelectedLocationIds([]);
    context.state.setMessage({
      kind: 'success',
      text: context.pt('masterData.collectionLocations.bulk.messages.deleteSuccess'),
    });
  } catch (deleteError) {
    context.state.setMessage({
      kind: 'error',
      text: runDeleteMessage(context.pt, resolveApiErrorCode(deleteError), true),
    });
  } finally {
    context.state.setSaving(false);
  }
};

export const createLocationBulkAssignmentsHandler = (context: LocationMutationContext) => async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();
  context.state.setSaving(true);
  context.state.setMessage(null);
  context.state.setLastOutcome(null);
  try {
    await submitWasteLocationTourLinksBulkInChunks(
      wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput(
        context.state.bulkAssignmentsForm,
        context.selectedCollectionLocationIds
      ),
      createWasteManagementLocationTourLinksBulk
    );
    await context.loadOverview(true);
    context.state.setBulkAssignmentsDialogOpen(false);
    context.state.setSelectedLocationIds([]);
    context.state.setMessage({
      kind: 'success',
      text: context.pt('masterData.collectionLocations.bulk.messages.assignSuccess'),
    });
  } catch (saveError) {
    const code = resolveApiErrorCode(saveError);
    context.state.setMessage({
      kind: 'error',
      text:
        code === 'forbidden'
          ? context.pt('masterData.collectionLocations.bulk.messages.assignForbidden')
          : context.pt('masterData.collectionLocations.bulk.messages.assignError'),
    });
  } finally {
    context.state.setSaving(false);
  }
};
