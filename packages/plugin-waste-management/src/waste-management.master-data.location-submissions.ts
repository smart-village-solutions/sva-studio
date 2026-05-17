import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCollectionLocation,
  createWasteManagementLocationTourLinksBulk,
  updateWasteManagementCollectionLocation,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess, type WasteMasterDataState } from './waste-management.master-data.state.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteMasterDataLocationSubmissions = ({
  state,
  pt,
  loadOverview,
  selectedCollectionLocationIds,
}: {
  state: WasteMasterDataState;
  pt: Translate;
  loadOverview: (active?: boolean) => Promise<void>;
  selectedCollectionLocationIds: readonly string[];
}) => ({
  onSubmitLocation: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    const formData = new FormData(event.currentTarget);
    const submittedForm: CollectionLocationFormState = {
      ...state.locationForm,
      regionId: String(formData.get('regionId') ?? state.locationForm.regionId),
      cityId: String(formData.get('cityId') ?? state.locationForm.cityId),
      streetId: String(formData.get('streetId') ?? state.locationForm.streetId),
      houseNumberId: String(formData.get('houseNumberId') ?? state.locationForm.houseNumberId),
    };
    try {
      if (state.locationDialogMode === 'create') {
        await createWasteManagementCollectionLocation(wasteMasterDataInputMappers.toCreateCollectionLocationInput(submittedForm));
      } else {
        await updateWasteManagementCollectionLocation(state.locationForm.id, wasteMasterDataInputMappers.toUpdateCollectionLocationInput(submittedForm));
      }
      await loadOverview(true);
      applySuccess(
        () => state.setLocationDialogOpen(false),
        state.setMessage,
        state.locationDialogMode === 'create'
          ? pt('masterData.collectionLocations.messages.createSuccess')
          : pt('masterData.collectionLocations.messages.updateSuccess'),
        () => state.setLastOutcome(state.locationDialogMode === 'create' ? 'location-create-success' : 'location-update-success')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.collectionLocations.messages.saveForbidden') : pt('masterData.collectionLocations.messages.saveError') });
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
