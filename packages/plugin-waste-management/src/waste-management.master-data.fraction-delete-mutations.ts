import {
  deleteWasteManagementFraction,
  type WasteFractionMutationResponse,
} from './waste-management.api.js';
import {
  applyFractionSyncResult,
  type FractionRegionSubmissionHelperContext,
} from './waste-management.master-data.fraction-sync.js';
import {
  resolveApiErrorCode,
  type WasteBulkDeleteResult,
} from './waste-management.page.support.js';

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

const refreshAfterDelete = async (ctx: FractionRegionSubmissionHelperContext) => {
  try {
    await ctx.loadOverview(true);
    return true;
  } catch {
    ctx.state.setMessage({
      kind: 'warning',
      text: ctx.pt('masterData.fractions.messages.refreshAfterDeleteError'),
    });
    return false;
  }
};

const applyFractionSyncResults = (
  ctx: FractionRegionSubmissionHelperContext,
  responses: readonly WasteFractionMutationResponse<{ readonly id: string }>[]
) => {
  const queuedJobs = responses.flatMap((response) =>
    response.syncStatus === 'queued' && response.syncJob ? [response.syncJob] : []
  );
  if (queuedJobs.length === responses.length) {
    ctx.state.setTrackedSyncWasteTypesJob(queuedJobs.at(-1) ?? null);
    return true;
  }

  ctx.state.setTrackedSyncWasteTypesJob(null);
  ctx.state.setMessage({
    kind: 'warning',
    text: ctx.pt('masterData.fractions.messages.syncWarning'),
    retryAction: 'sync-waste-types',
  });
  return false;
};

export const createDeleteFractionHandler =
  (ctx: FractionRegionSubmissionHelperContext) => async (fractionId: string) => {
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      let response: WasteFractionMutationResponse<{ readonly id: string }>;
      try {
        response = await deleteWasteManagementFraction(fractionId);
      } catch (error) {
        setDeleteErrorMessage(ctx, error);
        throw error;
      }
      const syncStarted = applyFractionSyncResult(ctx, response);
      if (!(await refreshAfterDelete(ctx))) return;
      if (syncStarted) {
        ctx.state.setMessage({
          kind: 'success',
          text: ctx.pt('masterData.fractions.messages.deleteSuccess'),
        });
      }
    } finally {
      ctx.state.setSaving(false);
    }
  };

export const createDeleteFractionsHandler =
  (ctx: FractionRegionSubmissionHelperContext) =>
  async (fractionIds: readonly string[]): Promise<WasteBulkDeleteResult> => {
    if (!fractionIds.length) return { failedIds: [] };
    ctx.state.setSaving(true);
    ctx.state.setMessage(null);
    ctx.state.setLastOutcome(null);
    try {
      const results = await Promise.allSettled(
        fractionIds.map((fractionId) => deleteWasteManagementFraction(fractionId))
      );
      const fulfilledResults = results.filter(
        (
          result
        ): result is PromiseFulfilledResult<
          WasteFractionMutationResponse<{ readonly id: string }>
        > => result.status === 'fulfilled'
      );
      const deletedCount = fulfilledResults.length;
      const failedIds = fractionIds.filter((_, index) => results[index]?.status === 'rejected');
      const failedResults = results.filter((result) => result.status === 'rejected');
      let syncStarted = false;
      if (deletedCount > 0) {
        syncStarted = applyFractionSyncResults(
          ctx,
          fulfilledResults.map(({ value }) => value)
        );
        if (!(await refreshAfterDelete(ctx))) return { failedIds };
      }
      if (failedResults.length === 0) {
        if (syncStarted) {
          ctx.state.setMessage({
            kind: 'success',
            text: ctx.pt('masterData.fractions.messages.deleteSuccess'),
          });
        }
        return { failedIds };
      }
      if (deletedCount > 0) {
        if (syncStarted) {
          ctx.state.setMessage({
            kind: 'success',
            text: ctx.pt('masterData.fractions.messages.deletePartialSuccess', {
              count: deletedCount,
              total: fractionIds.length,
            }),
          });
        }
        return { failedIds };
      }
      const deleteError = failedResults[0]?.reason;
      setDeleteErrorMessage(ctx, deleteError);
      throw deleteError;
    } finally {
      ctx.state.setSaving(false);
    }
  };
