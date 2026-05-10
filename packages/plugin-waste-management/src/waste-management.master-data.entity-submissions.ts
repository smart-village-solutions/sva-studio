import type { CityFormState, HouseNumberFormState, StreetFormState } from './waste-management.master-data.forms.js';
import {
  createWasteManagementCity,
  createWasteManagementFraction,
  createWasteManagementHouseNumber,
  createWasteManagementRegion,
  createWasteManagementStreet,
  updateWasteManagementCity,
  updateWasteManagementFraction,
  updateWasteManagementHouseNumber,
  updateWasteManagementRegion,
  updateWasteManagementStreet,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess, type WasteMasterDataState } from './waste-management.master-data.state.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteMasterDataEntitySubmissions = ({
  state,
  pt,
  search,
  loadOverview,
}: {
  state: WasteMasterDataState;
  pt: Translate;
  search: WasteManagementSearchParams;
  loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitFraction: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.dialogMode === 'create') {
        await createWasteManagementFraction(wasteMasterDataInputMappers.toCreateFractionInput(state.fractionForm));
      } else {
        await updateWasteManagementFraction(state.fractionForm.id, wasteMasterDataInputMappers.toUpdateFractionInput(state.fractionForm));
      }
      await loadOverview(true);
      applySuccess(() => state.setDialogOpen(false), state.setMessage, state.dialogMode === 'create' ? pt('masterData.fractions.messages.createSuccess') : pt('masterData.fractions.messages.updateSuccess'));
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.fractions.messages.saveForbidden') : pt('masterData.fractions.messages.saveError') });
    } finally {
      state.setSaving(false);
    }
  },
  onSubmitRegion: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.regionDialogMode === 'create') {
        await createWasteManagementRegion(wasteMasterDataInputMappers.toCreateRegionInput(state.regionForm));
      } else {
        await updateWasteManagementRegion(state.regionForm.id, wasteMasterDataInputMappers.toUpdateRegionInput(state.regionForm));
      }
      await loadOverview(true);
      applySuccess(() => state.setRegionDialogOpen(false), state.setMessage, state.regionDialogMode === 'create' ? pt('masterData.regions.messages.createSuccess') : pt('masterData.regions.messages.updateSuccess'));
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.regions.messages.saveForbidden') : pt('masterData.regions.messages.saveError') });
    } finally {
      state.setSaving(false);
    }
  },
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
        await updateWasteManagementCity(state.cityForm.id, wasteMasterDataInputMappers.toUpdateCityInput(submittedForm));
      }
      await loadOverview(true);
      applySuccess(() => state.setCityDialogOpen(false), state.setMessage, state.cityDialogMode === 'create' ? pt('masterData.cities.messages.createSuccess') : pt('masterData.cities.messages.updateSuccess'));
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.cities.messages.saveForbidden') : pt('masterData.cities.messages.saveError') });
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
    const submittedForm: StreetFormState = { ...state.streetForm, name: String(formData.get('name') ?? state.streetForm.name), cityId };
    try {
      if (state.streetDialogMode === 'create') {
        await createWasteManagementStreet(wasteMasterDataInputMappers.toCreateStreetInput(submittedForm));
      } else {
        await updateWasteManagementStreet(state.streetForm.id, wasteMasterDataInputMappers.toUpdateStreetInput(submittedForm));
      }
      await loadOverview(true);
      applySuccess(() => state.setStreetDialogOpen(false), state.setMessage, state.streetDialogMode === 'create' ? pt('masterData.streets.messages.createSuccess') : pt('masterData.streets.messages.updateSuccess'));
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.streets.messages.saveForbidden') : pt('masterData.streets.messages.saveError') });
    } finally {
      state.setSaving(false);
    }
  },
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
    const submittedForm: HouseNumberFormState = { ...state.houseNumberForm, number: String(formData.get('number') ?? state.houseNumberForm.number), streetId };
    try {
      if (state.houseNumberDialogMode === 'create') {
        await createWasteManagementHouseNumber(wasteMasterDataInputMappers.toCreateHouseNumberInput(submittedForm));
      } else {
        await updateWasteManagementHouseNumber(state.houseNumberForm.id, wasteMasterDataInputMappers.toUpdateHouseNumberInput(submittedForm));
      }
      await loadOverview(true);
      applySuccess(() => state.setHouseNumberDialogOpen(false), state.setMessage, state.houseNumberDialogMode === 'create' ? pt('masterData.houseNumbers.messages.createSuccess') : pt('masterData.houseNumbers.messages.updateSuccess'));
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({ kind: 'error', text: code === 'forbidden' ? pt('masterData.houseNumbers.messages.saveForbidden') : pt('masterData.houseNumbers.messages.saveError') });
    } finally {
      state.setSaving(false);
    }
  },
});
