import type { WasteFractionRecord } from '@sva/plugin-sdk';

import {
  createWasteManagementFraction,
  createWasteManagementRegion,
  updateWasteManagementFraction,
  updateWasteManagementRegion,
} from './waste-management.api.js';
import {
  wasteMasterDataFormMappers,
  wasteMasterDataInputMappers,
} from './waste-management.master-data.forms.js';
import { applySuccess } from './use-waste-master-data-state.js';
import {
  applyFractionSyncResult,
  type FractionRegionSubmissionHelperContext,
} from './waste-management.master-data.fraction-sync.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

export {
  createDeleteFractionHandler,
  createDeleteFractionsHandler,
} from './waste-management.master-data.fraction-delete-mutations.js';

const setFractionSaveErrorMessage = (
  ctx: FractionRegionSubmissionHelperContext,
  error: unknown
) => {
  const code = resolveApiErrorCode(error);
  ctx.state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? ctx.pt('masterData.fractions.messages.saveForbidden')
        : code === 'conflict'
          ? ctx.pt('masterData.fractions.messages.saveConflict')
          : ctx.pt('masterData.fractions.messages.saveError'),
  });
};

const setRegionSaveErrorMessage = (ctx: FractionRegionSubmissionHelperContext, error: unknown) => {
  const code = resolveApiErrorCode(error);
  ctx.state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? ctx.pt('masterData.regions.messages.saveForbidden')
        : ctx.pt('masterData.regions.messages.saveError'),
  });
};

export const createFractionMutationHandler =
  (ctx: FractionRegionSubmissionHelperContext) =>
  async (event: React.FormEvent<HTMLFormElement>, mode = ctx.state.dialogMode) => {
    event.preventDefault();
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      const response =
        mode === 'create'
          ? await createWasteManagementFraction(
              wasteMasterDataInputMappers.toCreateFractionInput(ctx.state.fractionForm)
            )
          : await updateWasteManagementFraction(
              ctx.state.fractionForm.id,
              wasteMasterDataInputMappers.toUpdateFractionInput(ctx.state.fractionForm)
            );

      await ctx.loadOverview(true);
      const syncStarted = applyFractionSyncResult(ctx, response);
      applySuccess(
        () => ctx.state.setDialogOpen(false),
        ctx.state.setMessage,
        mode === 'create'
          ? ctx.pt('masterData.fractions.messages.createSuccess')
          : ctx.pt('masterData.fractions.messages.updateSuccess'),
        () =>
          ctx.state.setLastOutcome(
            mode === 'create' ? 'fraction-create-success' : 'fraction-update-success'
          ),
        syncStarted
      );
    } catch (error) {
      setFractionSaveErrorMessage(ctx, error);
    } finally {
      ctx.state.setSaving(false);
    }
  };

export const createSetFractionActiveHandler =
  (ctx: FractionRegionSubmissionHelperContext) =>
  async (fraction: WasteFractionRecord, active: boolean) => {
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      const response = await updateWasteManagementFraction(
        fraction.id,
        wasteMasterDataInputMappers.toUpdateFractionInput({
          ...wasteMasterDataFormMappers.fractionToForm(fraction),
          active,
        })
      );
      await ctx.loadOverview(true);
      applyFractionSyncResult(ctx, response);
    } catch (error) {
      setFractionSaveErrorMessage(ctx, error);
    } finally {
      ctx.state.setSaving(false);
    }
  };

export const createSubmitRegionHandler =
  (ctx: FractionRegionSubmissionHelperContext) =>
  async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      if (ctx.state.regionDialogMode === 'create') {
        await createWasteManagementRegion(
          wasteMasterDataInputMappers.toCreateRegionInput(ctx.state.regionForm)
        );
      } else {
        await updateWasteManagementRegion(
          ctx.state.regionForm.id,
          wasteMasterDataInputMappers.toUpdateRegionInput(ctx.state.regionForm)
        );
      }
      await Promise.all([ctx.loadOverview(true), ctx.loadCollectionLocationList()]);
      applySuccess(
        () => ctx.state.setRegionDialogOpen(false),
        ctx.state.setMessage,
        ctx.state.regionDialogMode === 'create'
          ? ctx.pt('masterData.regions.messages.createSuccess')
          : ctx.pt('masterData.regions.messages.updateSuccess')
      );
    } catch (error) {
      setRegionSaveErrorMessage(ctx, error);
    } finally {
      ctx.state.setSaving(false);
    }
  };
