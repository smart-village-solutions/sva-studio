import type { WasteFractionRecord } from '@sva/plugin-sdk';

import {
  createWasteManagementFraction,
  createWasteManagementRegion,
  deleteWasteManagementFraction,
  startWasteManagementSyncWasteTypes,
  updateWasteManagementFraction,
  updateWasteManagementRegion,
} from './waste-management.api.js';
import { wasteMasterDataFormMappers, wasteMasterDataInputMappers } from './waste-management.master-data.forms.js';
import { applySuccess } from './waste-management.master-data.state.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type FractionRegionSubmissionHelperContext = {
  readonly state: WasteMasterDataState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
};

const setDeleteErrorMessage = (ctx: FractionRegionSubmissionHelperContext, error: unknown) => {
  const code = resolveApiErrorCode(error);
  ctx.state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? ctx.pt('masterData.fractions.messages.deleteForbidden')
        : code === 'invalid_request'
          ? ctx.pt('masterData.fractions.messages.deleteConflict')
          : ctx.pt('masterData.fractions.messages.deleteError'),
  });
};

const setFractionSaveErrorMessage = (ctx: FractionRegionSubmissionHelperContext, error: unknown) => {
  const code = resolveApiErrorCode(error);
  ctx.state.setMessage({
    kind: 'error',
    text:
      code === 'forbidden'
        ? ctx.pt('masterData.fractions.messages.saveForbidden')
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

const startFractionSyncWithWarning = async (ctx: FractionRegionSubmissionHelperContext) => {
  try {
    const job = await startWasteManagementSyncWasteTypes();
    ctx.state.setTrackedSyncWasteTypesJob(job ?? null);
    return true;
  } catch {
    ctx.state.setTrackedSyncWasteTypesJob(null);
    ctx.state.setMessage({
      kind: 'warning',
      text: ctx.pt('masterData.fractions.messages.syncWarning'),
      retryAction: 'sync-waste-types',
    });
    return false;
  }
};

export const createSubmitFractionHandler =
  (ctx: FractionRegionSubmissionHelperContext) =>
  async (event: React.FormEvent<HTMLFormElement>, mode = ctx.state.dialogMode) => {
    event.preventDefault();
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      if (mode === 'create') {
        await createWasteManagementFraction(wasteMasterDataInputMappers.toCreateFractionInput(ctx.state.fractionForm));
      } else {
        await updateWasteManagementFraction(
          ctx.state.fractionForm.id,
          wasteMasterDataInputMappers.toUpdateFractionInput(ctx.state.fractionForm)
        );
      }
      await ctx.loadOverview(true);
      const syncStarted = await startFractionSyncWithWarning(ctx);
      applySuccess(
        () => ctx.state.setDialogOpen(false),
        ctx.state.setMessage,
        mode === 'create'
          ? ctx.pt('masterData.fractions.messages.createSuccess')
          : ctx.pt('masterData.fractions.messages.updateSuccess'),
        () => ctx.state.setLastOutcome(mode === 'create' ? 'fraction-create-success' : 'fraction-update-success'),
        syncStarted
      );
    } catch (error) {
      setFractionSaveErrorMessage(ctx, error);
    } finally {
      ctx.state.setSaving(false);
    }
  };

export const createDeleteFractionHandler = (ctx: FractionRegionSubmissionHelperContext) => async (fractionId: string) => {
  ctx.state.setSaving(true);
  ctx.state.setMessage(null);
  ctx.state.setLastOutcome(null);
  try {
    await deleteWasteManagementFraction(fractionId);
    await ctx.loadOverview(true);
    const syncStarted = await startFractionSyncWithWarning(ctx);
    if (syncStarted) {
      ctx.state.setMessage({ kind: 'success', text: ctx.pt('masterData.fractions.messages.deleteSuccess') });
    }
  } catch (error) {
    setDeleteErrorMessage(ctx, error);
  } finally {
    ctx.state.setSaving(false);
  }
};

export const createDeleteFractionsHandler = (ctx: FractionRegionSubmissionHelperContext) => async (fractionIds: readonly string[]) => {
  if (!fractionIds.length) return;
  ctx.state.setSaving(true);
  ctx.state.setMessage(null);
  ctx.state.setLastOutcome(null);
  try {
    const results = await Promise.allSettled(fractionIds.map((fractionId) => deleteWasteManagementFraction(fractionId)));
    const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
    const failedResults = results.filter((result) => result.status === 'rejected');
    if (deletedCount > 0) {
      await ctx.loadOverview(true);
    }
    if (failedResults.length === 0) {
      const syncStarted = await startFractionSyncWithWarning(ctx);
      if (syncStarted) {
        ctx.state.setMessage({ kind: 'success', text: ctx.pt('masterData.fractions.messages.deleteSuccess') });
      }
      return;
    }
    if (deletedCount > 0) {
      const syncStarted = await startFractionSyncWithWarning(ctx);
      if (syncStarted) {
        ctx.state.setMessage({
          kind: 'success',
          text: ctx.pt('masterData.fractions.messages.deletePartialSuccess', { count: deletedCount, total: fractionIds.length }),
        });
      }
      return;
    }
    setDeleteErrorMessage(ctx, failedResults[0]?.reason);
  } finally {
    ctx.state.setSaving(false);
  }
};

export const createSetFractionActiveHandler = (ctx: FractionRegionSubmissionHelperContext) => async (
  fraction: WasteFractionRecord,
  active: boolean
) => {
  ctx.state.setSaving(true);
  ctx.state.setMessage(null);
  ctx.state.setLastOutcome(null);
  try {
    await updateWasteManagementFraction(
      fraction.id,
      wasteMasterDataInputMappers.toUpdateFractionInput({
        ...wasteMasterDataFormMappers.fractionToForm(fraction),
        active,
      })
    );
    await ctx.loadOverview(true);
    await startFractionSyncWithWarning(ctx);
  } catch (error) {
    setFractionSaveErrorMessage(ctx, error);
  } finally {
    ctx.state.setSaving(false);
  }
};

export const createSubmitRegionHandler = (ctx: FractionRegionSubmissionHelperContext) => async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  ctx.state.setSaving(true);
  ctx.state.setMessage(null);
  ctx.state.setLastOutcome(null);
  try {
    if (ctx.state.regionDialogMode === 'create') {
      await createWasteManagementRegion(wasteMasterDataInputMappers.toCreateRegionInput(ctx.state.regionForm));
    } else {
      await updateWasteManagementRegion(
        ctx.state.regionForm.id,
        wasteMasterDataInputMappers.toUpdateRegionInput(ctx.state.regionForm)
      );
    }
    await ctx.loadOverview(true);
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
