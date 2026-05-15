import {
  createWasteManagementFraction,
  deleteWasteManagementFraction,
  createWasteManagementRegion,
  updateWasteManagementFraction,
  updateWasteManagementRegion,
} from './waste-management.api.js';
import { wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './waste-management.master-data.state.js';
import type { WasteMasterDataSubmissionContext } from './waste-management.master-data.submission.types.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export const createWasteMasterDataFractionRegionSubmissions = ({
  state,
  pt,
  loadOverview,
}: WasteMasterDataSubmissionContext) => ({
  onSubmitFraction: async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.dialogMode === 'create') {
        await createWasteManagementFraction(wasteMasterDataInputMappers.toCreateFractionInput(state.fractionForm));
      } else {
        await updateWasteManagementFraction(
          state.fractionForm.id,
          wasteMasterDataInputMappers.toUpdateFractionInput(state.fractionForm)
        );
      }
      await loadOverview(true);
      applySuccess(
        () => state.setDialogOpen(false),
        state.setMessage,
        state.dialogMode === 'create'
          ? pt('masterData.fractions.messages.createSuccess')
          : pt('masterData.fractions.messages.updateSuccess')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.fractions.messages.saveForbidden')
            : pt('masterData.fractions.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  deleteFraction: async (fractionId: string) => {
    state.setSaving(true);
    state.setMessage(null);
    try {
      await deleteWasteManagementFraction(fractionId);
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt('masterData.fractions.messages.deleteSuccess'),
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.fractions.messages.deleteForbidden')
            : code === 'invalid_request'
              ? pt('masterData.fractions.messages.deleteConflict')
              : pt('masterData.fractions.messages.deleteError'),
      });
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
        await updateWasteManagementRegion(
          state.regionForm.id,
          wasteMasterDataInputMappers.toUpdateRegionInput(state.regionForm)
        );
      }
      await loadOverview(true);
      applySuccess(
        () => state.setRegionDialogOpen(false),
        state.setMessage,
        state.regionDialogMode === 'create'
          ? pt('masterData.regions.messages.createSuccess')
          : pt('masterData.regions.messages.updateSuccess')
      );
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.regions.messages.saveForbidden')
            : pt('masterData.regions.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
