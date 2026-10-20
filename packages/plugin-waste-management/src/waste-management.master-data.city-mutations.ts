import type { CityFormState } from './waste-management.master-data.forms.js';
import { createWasteManagementCity, updateWasteManagementCity } from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { resolveWasteAddressSaveErrorMessage } from './waste-management.master-data.form-helpers.js';
import { applySuccess } from './use-waste-master-data-state.js';
import { confirmWasteAddressMove } from './waste-management.master-data-address-move.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataCityMutations = ({
  state,
  pt,
  loadOverview,
  loadCollectionLocationList,
}: WasteMasterDataSubmissionContext) => ({
  onSubmitCity: async (event: React.FormEvent<HTMLFormElement>, form: HTMLFormElement) => {
    event.preventDefault();
    const formData = new FormData(form);
    state.setSaving(true);
    state.setMessage(null);
    const submittedForm: CityFormState = {
      ...state.cityForm,
      name: String(formData.get('name') ?? state.cityForm.name),
      postalCode: String(formData.get('postalCode') ?? state.cityForm.postalCode),
      regionId: String(formData.get('regionId') ?? state.cityForm.regionId),
    };
    try {
      if (state.cityDialogMode === 'create') {
        await createWasteManagementCity(
          wasteMasterDataInputMappers.toCreateCityInput(submittedForm)
        );
      } else {
        const existingCity = state.overview?.cities.find((city) => city.id === state.cityForm.id);
        const nextRegionId = submittedForm.regionId || undefined;
        if (existingCity && (existingCity.regionId ?? undefined) !== nextRegionId) {
          const sourceLabel = existingCity.regionId
            ? state.overview?.regions.find((region) => region.id === existingCity.regionId)?.name ?? pt('masterData.locationsWorkspace.addresses.noParent')
            : pt('masterData.locationsWorkspace.addresses.noParent');
          const targetLabel = nextRegionId
            ? state.overview?.regions.find((region) => region.id === nextRegionId)?.name ?? ''
            : pt('masterData.locationsWorkspace.addresses.noParent');
          await confirmWasteAddressMove({
            state, pt, entityType: 'city', entityId: existingCity.id, targetParentId: nextRegionId,
            sourceLabel, targetLabel,
            save: (confirmationToken) => updateWasteManagementCity(existingCity.id, {
              ...wasteMasterDataInputMappers.toUpdateCityInput(submittedForm), confirmationToken,
            }),
            closeDialog: () => state.setCityDialogOpen(false),
            successMessage: pt('masterData.cities.messages.updateSuccess'),
            loadOverview, loadCollectionLocationList,
          });
          return;
        }
        await updateWasteManagementCity(
          state.cityForm.id,
          wasteMasterDataInputMappers.toUpdateCityInput(submittedForm)
        );
      }
      await Promise.all([loadOverview(true), loadCollectionLocationList()]);
      applySuccess(
        () => state.setCityDialogOpen(false),
        state.setMessage,
        state.cityDialogMode === 'create'
          ? pt('masterData.cities.messages.createSuccess')
          : pt('masterData.cities.messages.updateSuccess')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text: resolveWasteAddressSaveErrorMessage(code, saveError, {
          forbidden: pt('masterData.cities.messages.saveForbidden'),
          conflict: pt('masterData.locationsWorkspace.addresses.previewStale'),
          inconsistent: pt('masterData.locationsWorkspace.addresses.previewError'),
          fallback: pt('masterData.cities.messages.saveError'),
        }),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
