import type { CityFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCity,
  updateWasteManagementCity,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './use-waste-master-data-state.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataCityMutations = ({
  state,
  pt,
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
      regionId: String(
        (formData.get('regionId') ?? state.cityForm.regionId) || (state.overview?.regions[0]?.id ?? '')
      ),
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
});
