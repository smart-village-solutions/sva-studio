import type { HouseNumberFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementHouseNumber,
  updateWasteManagementHouseNumber,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './use-waste-master-data-state.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataHouseNumberMutations = ({
  state,
  pt,
  loadOverview,
}: WasteMasterDataSubmissionContext) => ({
  onSubmitHouseNumber: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    const formData = new FormData(event.currentTarget);
    const streetId =
      String(formData.get('streetId') ?? state.houseNumberForm.streetId).trim() ||
      state.houseNumberForm.streetId ||
      wasteMasterDataInputMappers.resolveSingleSelectValue(event.currentTarget, 'streetId') ||
      state.overview?.streets[0]?.id ||
      '';
    const submittedForm: HouseNumberFormState = {
      ...state.houseNumberForm,
      number: String(formData.get('number') ?? state.houseNumberForm.number),
      streetId,
    };
    try {
      if (state.houseNumberDialogMode === 'create') {
        await createWasteManagementHouseNumber(wasteMasterDataInputMappers.toCreateHouseNumberInput(submittedForm));
      } else {
        await updateWasteManagementHouseNumber(
          state.houseNumberForm.id,
          wasteMasterDataInputMappers.toUpdateHouseNumberInput(submittedForm)
        );
      }
      await loadOverview(true);
      applySuccess(
        () => state.setHouseNumberDialogOpen(false),
        state.setMessage,
        state.houseNumberDialogMode === 'create'
          ? pt('masterData.houseNumbers.messages.createSuccess')
          : pt('masterData.houseNumbers.messages.updateSuccess')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.houseNumbers.messages.saveForbidden')
            : pt('masterData.houseNumbers.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
