import {
  type WasteAnnualTourTransferCreateInput,
  type WasteAnnualTourTransferResult,
} from '@sva/waste-management-contracts';

import type { AuthenticatedRequestContext } from './types.js';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
} from '@sva/server-runtime';
import { validateCsrf } from './host-controls.js';
import { authorizeWasteManagementAction } from './auth.js';
import { completeAnnualTourTransfer } from './annual-tour-transfer-execution.js';
import { toAnnualTourTransferDomainErrorResponse } from './annual-tour-transfer-errors.js';
import {
  reserveAnnualTourTransfer,
  startAnnualTourTransferLeaseHeartbeat,
} from './annual-tour-transfer-idempotency.js';
import { wasteManagementTourSchemas } from '../http-schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const authorizeAnnualTourTransfer = async (
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  requestId: string | undefined
): Promise<Response | null> => {
  const toursError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.tours.manage',
    deps,
    requestId
  );
  if (toursError) return toursError;
  return authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
};

const jsonItemResponse = (status: number, data: unknown, requestId?: string): Response =>
  new Response(JSON.stringify(asApiItem(data, requestId)), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const executeConfirmedAnnualTourTransfer = async (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  create: WasteAnnualTourTransferCreateInput;
  requestId?: string;
  ctx: AuthenticatedRequestContext;
  deps: WasteManagementHandlerDeps;
}): Promise<Response> => {
  const reservation = await reserveAnnualTourTransfer(input);
  if ('response' in reservation) return reservation.response;
  const leaseHeartbeat = startAnnualTourTransferLeaseHeartbeat({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    idempotencyKey: input.idempotencyKey,
    leaseToken: reservation.leaseToken,
    deps: input.deps,
  });
  let result: WasteAnnualTourTransferResult | undefined;
  let response: Response;
  try {
    try {
      result = await requireDeps(
        input.deps.createWasteAnnualTourTransfer,
        'createWasteAnnualTourTransfer'
      )({ instanceId: input.instanceId, create: input.create });
      response = jsonItemResponse(201, result, input.requestId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) throw error;
      response =
        toAnnualTourTransferDomainErrorResponse(error, input.requestId) ??
        createApiError(
          503,
          'database_unavailable',
          'Der Tourensatz konnte nicht vollständig angelegt werden.',
          input.requestId
        );
    }
    if (!(await leaseHeartbeat.verify())) {
      return createApiError(
        409,
        'idempotency_in_progress',
        'Der Request wurde durch einen Wiederholungsversuch übernommen.',
        input.requestId
      );
    }
    return await completeAnnualTourTransfer({
      ...input,
      result,
      response,
      leaseToken: reservation.leaseToken,
    });
  } finally {
    await leaseHeartbeat.stop();
  }
};

export const wasteManagementAnnualTourTransferHandlers = {
  previewWasteAnnualTourTransferInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeAnnualTourTransfer(ctx, deps, requestId);
    if (authError) return authError;
    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) return instanceId;
    const csrfError = validateCsrf(deps, request, requestId);
    if (csrfError) return csrfError;
    const parsed = await parseRequestBody(
      request,
      wasteManagementTourSchemas.previewWasteAnnualTourTransferSchema
    );
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
    try {
      const preview = await requireDeps(
        deps.previewWasteAnnualTourTransfer,
        'previewWasteAnnualTourTransfer'
      )({
        instanceId,
        sourceYear: parsed.data.sourceYear,
        selectedTourIds: parsed.data.selectedTourIds,
        replacementDates: parsed.data.replacementDates,
        firstTargetDates: parsed.data.firstTargetDates,
      });
      return jsonItemResponse(200, preview, requestId);
    } catch (error) {
      const domainResponse = toAnnualTourTransferDomainErrorResponse(error, requestId);
      if (domainResponse) return domainResponse;
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) throw error;
      return createApiError(
        503,
        'database_unavailable',
        'Die Vorschau für das Folgejahr konnte nicht erstellt werden.',
        requestId
      );
    }
  },

  createWasteAnnualTourTransferInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeAnnualTourTransfer(ctx, deps, requestId);
    if (authError) return authError;
    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) return instanceId;
    const csrfError = validateCsrf(deps, request, requestId);
    if (csrfError) return csrfError;
    const idempotencyKey = requireIdempotencyKey(request, requestId);
    if ('error' in idempotencyKey) return idempotencyKey.error;
    const parsed = await parseRequestBody(
      request,
      wasteManagementTourSchemas.createWasteAnnualTourTransferSchema
    );
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
    const actorResolution = await requireDeps(deps.resolveActorInfo, 'resolveActorInfo')(
      request,
      ctx
    );
    if ('error' in actorResolution) return actorResolution.error;
    const actorAccountId = actorResolution.actor.actorAccountId;
    if (!actorAccountId) {
      return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', requestId);
    }

    return executeConfirmedAnnualTourTransfer({
      instanceId,
      actorAccountId,
      idempotencyKey: idempotencyKey.key,
      create: parsed.data,
      requestId,
      deps,
      ctx,
    });
  },
};
