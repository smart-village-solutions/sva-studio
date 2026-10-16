import type { StreetFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementStreet,
  updateWasteManagementStreet,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './use-waste-master-data-state.js';
import { confirmWasteAddressMove } from './waste-management.master-data-address-move.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode, resolveWasteAddressSaveErrorMessage } from './waste-management.page.support.js';

export const createWasteMasterDataStreetMutations = ({
  state,
  pt,
  search,
  loadOverview,
  loadCollectionLocationList,
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
        await createWasteManagementStreet(
          wasteMasterDataInputMappers.toCreateStreetInput(submittedForm)
        );
      } else {
        const existingStreet = state.overview?.streets.find((street) => street.id === state.streetForm.id);
        if (existingStreet && existingStreet.cityId !== submittedForm.cityId) {
          const cityLabel = (id: string) => {
            const city = state.overview?.cities.find((item) => item.id === id);
            const region = city?.regionId ? state.overview?.regions.find((item) => item.id === city.regionId)?.name : undefined;
            return [city?.postalCode, city?.name, region].filter(Boolean).join(' · ');
          };
          await confirmWasteAddressMove({
            state, pt, entityType: 'street', entityId: existingStreet.id, targetParentId: submittedForm.cityId,
            sourceLabel: cityLabel(existingStreet.cityId), targetLabel: cityLabel(submittedForm.cityId),
            save: (confirmationToken) => updateWasteManagementStreet(existingStreet.id, {
              ...wasteMasterDataInputMappers.toUpdateStreetInput(submittedForm), confirmationToken,
            }),
            closeDialog: () => state.setStreetDialogOpen(false),
            successMessage: pt('masterData.streets.messages.updateSuccess'),
            loadOverview, loadCollectionLocationList,
          });
          return;
        }
        await updateWasteManagementStreet(
          state.streetForm.id,
          wasteMasterDataInputMappers.toUpdateStreetInput(submittedForm)
        );
      }
      await Promise.all([loadOverview(true), loadCollectionLocationList()]);
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
        text: resolveWasteAddressSaveErrorMessage(code, saveError, {
          forbidden: pt('masterData.streets.messages.saveForbidden'),
          conflict: pt('masterData.locationsWorkspace.addresses.previewStale'),
          inconsistent: pt('masterData.locationsWorkspace.addresses.previewError'),
          fallback: pt('masterData.streets.messages.saveError'),
        }),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
