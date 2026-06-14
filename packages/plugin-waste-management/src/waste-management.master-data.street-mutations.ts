import type { StreetFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementStreet,
  updateWasteManagementStreet,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './use-waste-master-data-state.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataStreetMutations = ({
  state,
  pt,
  search,
  loadOverview,
}: WasteMasterDataSubmissionContext) => ({
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
