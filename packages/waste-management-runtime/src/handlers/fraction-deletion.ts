/** Existing single-fraction preview and deletion HTTP handlers. */
import type { WasteFractionDeleteConfirmation } from '@sva/waste-management-contracts';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { asApiItem, createApiError, parseRequestBody } from '@sva/server-runtime';
import { emitWasteAuditEvent } from './auth.js';
import {
  createWasteFractionMutationResponse,
  enqueueWasteTypesSyncAfterMutation,
} from './fractions-support.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { wasteManagementMasterDataSchemas } from '../http-schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import { requireDeps } from './utils.js';
const fractionDeletionError = (error: unknown, requestId?: string): Response | null => {
  if (!(error instanceof Error)) return null;
  if (error.message === 'fraction_not_found')
    return createApiError(404, 'not_found', 'Die Abfallfraktion wurde nicht gefunden.', requestId);
  if (error.message === 'fraction_preview_stale')
    return createApiError(
      409,
      'invalid_request',
      'Die Auswirkungen haben sich geändert. Bitte aktualisieren Sie die Vorschau.',
      requestId
    );
  if (error.message.startsWith('fraction_delete_blocked:'))
    return createApiError(
      409,
      'invalid_request',
      'Die gewählte Löschung ist nicht möglich. Bitte prüfen Sie die Vorschau.',
      requestId
    );
  if ('code' in error && ['40001', '40P01', '55P03', '57014'].includes(String(error.code)))
    return createApiError(
      409,
      'invalid_request',
      'Die Daten werden gerade geändert. Bitte aktualisieren Sie die Vorschau.',
      requestId
    );
  return null;
};

const readConfirmation = async (
  request: Request,
  fractionId: string,
  requestId?: string
): Promise<WasteFractionDeleteConfirmation | Response | undefined> => {
  if (request.body !== null) {
    const parsed = await parseRequestBody(
      request,
      wasteManagementMasterDataSchemas.wasteFractionDeleteSchema
    );
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
    if (
      !wasteManagementMasterDataSchemas.wasteFractionDeletePreviewSchema.shape.fractionId.safeParse(
        fractionId
      ).success
    ) {
      return createApiError(400, 'invalid_request', 'Ungültige Fraktions-ID.', requestId);
    }
    return { fractionId, ...parsed.data };
  }

  return undefined;
};
const reportDeletionFailure = async (
  error: unknown,
  deps: WasteManagementHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  fractionId: string,
  requestId?: string
): Promise<Response> => {
  if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
    throw error;
  }
  const deletionError = fractionDeletionError(error, requestId);
  const isConflict =
    deletionError?.status === 409 ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23503');
  await emitWasteAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'waste-management.fraction.deleted',
    result: 'failure',
    reasonCode: isConflict ? 'conflict' : 'database_unavailable',
    resourceType: 'waste_fraction',
    resourceId: fractionId,
  });
  await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
  if (deletionError) return deletionError;
  return isConflict
    ? createApiError(
        409,
        'invalid_request',
        'Die Waste-Fraktion kann wegen bestehender Zuordnungen nicht gelöscht werden.',
        requestId
      )
    : createApiError(
        503,
        'database_unavailable',
        'Die Waste-Fraktion konnte nicht gelöscht werden.',
        requestId
      );
};
export const wasteManagementFractionDeletionHandlers = {
  previewWasteManagementFractionDeletionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) return authorized;
    const parsed = await parseRequestBody(
      request,
      wasteManagementMasterDataSchemas.wasteFractionDeletePreviewSchema
    );
    if (!parsed.ok)
      return createApiError(400, 'invalid_request', parsed.message, authorized.requestId);
    try {
      const preview = await requireDeps(
        deps.previewWasteFractionDeletion,
        'previewWasteFractionDeletion'
      )(authorized.instanceId, parsed.data);
      return Response.json(asApiItem(preview, authorized.requestId));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) throw error;
      return (
        fractionDeletionError(error, authorized.requestId) ??
        createApiError(
          503,
          'database_unavailable',
          'Die Löschvorschau konnte nicht geladen werden.',
          authorized.requestId
        )
      );
    }
  },
  deleteWasteManagementFractionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'fractionId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: fractionId } = authorized;
    const confirmation = await readConfirmation(request, fractionId, requestId);
    if (confirmation instanceof Response) return confirmation;

    try {
      const existing = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(
        instanceId,
        fractionId
      );
      if (!existing) {
        return createApiError(
          404,
          'not_found',
          'Die Waste-Fraktion wurde nicht gefunden.',
          requestId
        );
      }

      if (confirmation)
        await requireDeps(deps.executeWasteFractionDeletion, 'executeWasteFractionDeletion')(
          instanceId,
          confirmation
        );
      else
        await requireDeps(deps.deleteWasteFraction, 'deleteWasteFraction')(instanceId, fractionId);

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.fraction.deleted',
        result: 'success',
        resourceType: 'waste_fraction',
        resourceId: fractionId,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      const syncMetadata = await enqueueWasteTypesSyncAfterMutation(request, ctx, deps, instanceId);
      return createWasteFractionMutationResponse(200, { id: fractionId }, requestId, syncMetadata);
    } catch (error) {
      return reportDeletionFailure(error, deps, ctx, instanceId, fractionId, requestId);
    }
  },
};
