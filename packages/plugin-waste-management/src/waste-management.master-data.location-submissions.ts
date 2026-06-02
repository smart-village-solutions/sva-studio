import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCollectionLocation,
  deleteWasteManagementCollectionLocation,
  createWasteManagementLocationTourLinksBulk,
  updateWasteManagementCollectionLocation,
  WasteManagementApiError,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess, type WasteMasterDataState } from './waste-management.master-data.state.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

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

export const createWasteMasterDataLocationSubmissions = ({
  state,
  pt,
  search,
  loadOverview,
  selectedCollectionLocationIds,
}: {
  state: WasteMasterDataState;
  pt: Translate;
  search: WasteManagementSearchParams;
  loadOverview: (active?: boolean) => Promise<void>;
  selectedCollectionLocationIds: readonly string[];
}) => ({
  onSubmitLocation: async (
    submittedForm: CollectionLocationFormState,
    mode = search.locationsView === 'edit' ? 'edit' : state.locationDialogMode
  ) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      if (mode === 'create') {
        await createWasteManagementCollectionLocation(wasteMasterDataInputMappers.toCreateCollectionLocationInput(submittedForm));
      } else {
        await updateWasteManagementCollectionLocation(submittedForm.id, wasteMasterDataInputMappers.toUpdateCollectionLocationInput(submittedForm));
      }
      await loadOverview(true);
      applySuccess(
        () => state.setLocationDialogOpen(false),
        state.setMessage,
        mode === 'create'
          ? pt('masterData.collectionLocations.messages.createSuccess')
          : pt('masterData.collectionLocations.messages.updateSuccess'),
        () => state.setLastOutcome(mode === 'create' ? 'location-create-success' : 'location-update-success')
      );
    } catch (saveError) {
      state.setMessage({ kind: 'error', text: resolveLocationSaveErrorMessage(saveError, pt) });
    } finally {
      state.setSaving(false);
    }
  },
  onDeleteLocation: async (location: { readonly id: string }) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      await deleteWasteManagementCollectionLocation(location.id);
      await loadOverview(true);
      state.setSelectedLocationIds((current) => current.filter((selectedId) => selectedId !== location.id));
      state.setMessage({ kind: 'success', text: pt('masterData.collectionLocations.messages.deleteSuccess') });
    } catch (deleteError) {
      const code = resolveApiErrorCode(deleteError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.collectionLocations.messages.deleteForbidden')
            : code === 'conflict'
              ? pt('masterData.collectionLocations.messages.deleteConflict')
              : pt('masterData.collectionLocations.messages.deleteError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  onDeleteLocations: async (locationIds: readonly string[]) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      for (const locationId of locationIds) {
        await deleteWasteManagementCollectionLocation(locationId);
      }
      await loadOverview(true);
      state.setSelectedLocationIds([]);
      state.setMessage({ kind: 'success', text: pt('masterData.collectionLocations.bulk.messages.deleteSuccess') });
    } catch (deleteError) {
      const code = resolveApiErrorCode(deleteError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.collectionLocations.bulk.messages.deleteForbidden')
            : code === 'conflict'
              ? pt('masterData.collectionLocations.bulk.messages.deleteConflict')
              : pt('masterData.collectionLocations.bulk.messages.deleteError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  onSubmitBulkAssignments: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      await createWasteManagementLocationTourLinksBulk(
        wasteMasterDataInputMappers.toCreateLocationTourLinksBulkInput(state.bulkAssignmentsForm, selectedCollectionLocationIds)
      );
      await loadOverview(true);
      state.setBulkAssignmentsDialogOpen(false);
      state.setSelectedLocationIds([]);
      state.setMessage({ kind: 'success', text: pt('masterData.collectionLocations.bulk.messages.assignSuccess') });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.collectionLocations.bulk.messages.assignForbidden') : pt('masterData.collectionLocations.bulk.messages.assignError') });
    } finally {
      state.setSaving(false);
    }
  },
});
