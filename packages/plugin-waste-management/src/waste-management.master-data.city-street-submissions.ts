import type { CityFormState, StreetFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCity,
  createWasteManagementStreet,
  updateWasteManagementCity,
  updateWasteManagementStreet,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './waste-management.master-data.state.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataCityStreetSubmissions = ({
  state,
  pt,
  search,
  loadOverview,
}: WasteMasterDataSubmissionContext) => ({
  onSubmitCity: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    const formData = new FormData(event.currentTarget);
    const submittedForm: CityFormState = {
      ...state.cityForm,
      name: String(formData.get('name') ?? state.cityForm.name),
      regionId: String((formData.get('regionId') ?? state.cityForm.regionId) || (state.overview?.regions[0]?.id ?? '')),
    };
    try {
      if (state.cityDialogMode === 'create') {
        await createWasteManagementCity(wasteMasterDataInputMappers.toCreateCityInput(submittedForm));
      } else {
        await updateWasteManagementCity(
          state.cityForm.id,
          wasteMasterDataInputMappers.toUpdateCityInput(submittedForm)
        );
      }
      await loadOverview(true);
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
        text:
          code === 'forbidden'
            ? pt('masterData.cities.messages.saveForbidden')
            : pt('masterData.cities.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  onSubmitStreet: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    const formData = new FormData(event.currentTarget);
    const cityId =
      String(formData.get('cityId') ?? state.streetForm.cityId).trim() ||
      state.streetForm.cityId ||
      wasteMasterDataInputMappers.resolveSingleSelectValue(event.currentTarget, 'cityId') ||
      search.cityId ||
      state.overview?.cities[0]?.id ||
      '';
    const submittedForm: StreetFormState = {
      ...state.streetForm,
      name: String(formData.get('name') ?? state.streetForm.name),
      cityId,
    };
    try {
      if (state.streetDialogMode === 'create') {
        await createWasteManagementStreet(wasteMasterDataInputMappers.toCreateStreetInput(submittedForm));
      } else {
        await updateWasteManagementStreet(
          state.streetForm.id,
          wasteMasterDataInputMappers.toUpdateStreetInput(submittedForm)
        );
      }
      await loadOverview(true);
      applySuccess(
        () => state.setStreetDialogOpen(false),
        state.setMessage,
        state.streetDialogMode === 'create'
          ? pt('masterData.streets.messages.createSuccess')
          : pt('masterData.streets.messages.updateSuccess')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.streets.messages.saveForbidden')
            : pt('masterData.streets.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
