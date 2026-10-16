import type { HouseNumberFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementHouseNumber,
  updateWasteManagementHouseNumber,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { resolveWasteAddressSaveErrorMessage } from './waste-management.master-data.form-helpers.js';
import { applySuccess } from './use-waste-master-data-state.js';
import { confirmWasteAddressMove } from './waste-management.master-data-address-move.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataHouseNumberMutations = ({
  state,
  pt,
  loadOverview,
  loadCollectionLocationList,
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
        await createWasteManagementHouseNumber(
          wasteMasterDataInputMappers.toCreateHouseNumberInput(submittedForm)
        );
      } else {
        const existingHouseNumber = state.overview?.houseNumbers.find((item) => item.id === state.houseNumberForm.id);
        if (existingHouseNumber && existingHouseNumber.streetId !== submittedForm.streetId) {
          const streetLabel = (id: string) => {
            const street = state.overview?.streets.find((item) => item.id === id);
            const city = street ? state.overview?.cities.find((item) => item.id === street.cityId) : undefined;
            const region = city?.regionId ? state.overview?.regions.find((item) => item.id === city.regionId)?.name : undefined;
            return [street?.name, city?.postalCode, city?.name, region].filter(Boolean).join(' · ');
          };
          await confirmWasteAddressMove({
            state, pt, entityType: 'houseNumber', entityId: existingHouseNumber.id, targetParentId: submittedForm.streetId,
            sourceLabel: streetLabel(existingHouseNumber.streetId), targetLabel: streetLabel(submittedForm.streetId),
            save: (confirmationToken) => updateWasteManagementHouseNumber(existingHouseNumber.id, {
              ...wasteMasterDataInputMappers.toUpdateHouseNumberInput(submittedForm), confirmationToken,
            }),
            closeDialog: () => state.setHouseNumberDialogOpen(false),
            successMessage: pt('masterData.houseNumbers.messages.updateSuccess'),
            loadOverview, loadCollectionLocationList,
          });
          return;
        }
        await updateWasteManagementHouseNumber(
          state.houseNumberForm.id,
          wasteMasterDataInputMappers.toUpdateHouseNumberInput(submittedForm)
        );
      }
      await Promise.all([loadOverview(true), loadCollectionLocationList()]);
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
        text: resolveWasteAddressSaveErrorMessage(code, saveError, {
          forbidden: pt('masterData.houseNumbers.messages.saveForbidden'),
          conflict: pt('masterData.locationsWorkspace.addresses.previewStale'),
          inconsistent: pt('masterData.locationsWorkspace.addresses.previewError'),
          fallback: pt('masterData.houseNumbers.messages.saveError'),
        }),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
