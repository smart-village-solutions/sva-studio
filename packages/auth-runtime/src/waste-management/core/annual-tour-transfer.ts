import {
  wasteAnnualTourTransferLimits,
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferPreview,
  type WasteAnnualTourTransferResult,
} from '@sva/core';

import { resolveActorInfo } from '../../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
} from '../../shared/request-helpers.js';
import { validateCsrf } from '../../shared/request-security.js';
import { authorizeWasteManagementAction } from './auth.js';
import {
  completeAnnualTourTransfer,
  reserveAnnualTourTransfer,
} from './annual-tour-transfer-execution.js';
import { wasteManagementTourSchemas } from './schemas.js';
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

const toDomainErrorResponse = (error: unknown, requestId: string | undefined): Response | null => {
  if (error instanceof WasteAnnualTourTransferError) {
    if (error.code === 'batch_limit_exceeded') {
      return createApiError(
        413,
        error.code,
        `Der Jahreswechsel überschreitet die Grenze von ${wasteAnnualTourTransferLimits.tours.toLocaleString('de-DE')} Touren oder ${wasteAnnualTourTransferLimits.relationships.toLocaleString('de-DE')} kopierrelevanten Beziehungen.`,
        requestId
      );
    }
    return createApiError(
      400,
      error.code,
      error.code === 'invalid_source_year'
        ? 'Als Quelljahr sind nur das aktuelle und das vorherige Kalenderjahr zulässig.'
        : 'Ein Ersatzdatum muss im direkten Folgejahr liegen.',
      requestId
    );
  }
  if (!(error instanceof Error)) return null;
  if (error.message.startsWith('preview_stale:')) {
    let updatedPreview: WasteAnnualTourTransferPreview | undefined;
    try {
      updatedPreview = JSON.parse(error.message.slice('preview_stale:'.length));
    } catch {
      updatedPreview = undefined;
    }
    return createApiError(
      409,
      'preview_stale',
      'Die Tourplanung hat sich geändert. Bitte prüfen und bestätigen Sie die aktualisierte Vorschau.',
      requestId,
      updatedPreview ? { updatedPreview } : undefined
    );
  }
  if (error.message.startsWith('target_identity_conflict:')) {
    let updatedPreview: WasteAnnualTourTransferPreview | undefined;
    try {
      updatedPreview = JSON.parse(error.message.slice('target_identity_conflict:'.length));
    } catch {
      updatedPreview = undefined;
    }
    return createApiError(
      409,
      'target_identity_conflict',
      'Ein vorhandenes Folgejahr-Ergebnis weicht von der bestätigten Planung ab.',
      requestId,
      updatedPreview ? { updatedPreview } : undefined
    );
  }
  if (error.message === 'unacknowledged_target_conflict') {
    return createApiError(
      409,
      'target_conflict_unacknowledged',
      'Eine mögliche parallele Planung muss vor der Übernahme ausdrücklich bestätigt werden.',
      requestId
    );
  }
  if (error.message === 'invalid_transfer_selection') {
    return createApiError(
      400,
      'invalid_request',
      'Die Auswahl enthält eine nicht übernehmbare Tour.',
      requestId
    );
  }
  return null;
};

const jsonItemResponse = (status: number, data: unknown, requestId?: string): Response =>
  new Response(JSON.stringify(asApiItem(data, requestId)), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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
    const csrfError = validateCsrf(request, requestId);
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
      });
      return jsonItemResponse(200, preview, requestId);
    } catch (error) {
      const domainResponse = toDomainErrorResponse(error, requestId);
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
    const csrfError = validateCsrf(request, requestId);
    if (csrfError) return csrfError;
    const idempotencyKey = requireIdempotencyKey(request, requestId);
    if ('error' in idempotencyKey) return idempotencyKey.error;
    const parsed = await parseRequestBody(
      request,
      wasteManagementTourSchemas.createWasteAnnualTourTransferSchema
    );
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
    const actorResolution = await (
      deps.resolveActorInfo ??
      ((scopedRequest: Request, scopedCtx: AuthenticatedRequestContext) =>
        resolveActorInfo(scopedRequest, scopedCtx, { requireActorMembership: true }))
    )(request, ctx);
    if ('error' in actorResolution) return actorResolution.error;
    const actorAccountId = actorResolution.actor.actorAccountId;
    if (!actorAccountId) {
      return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', requestId);
    }

    const reservationResponse = await reserveAnnualTourTransfer({
      instanceId,
      actorAccountId,
      idempotencyKey: idempotencyKey.key,
      create: parsed.data,
      requestId,
    });
    if (reservationResponse) return reservationResponse;

    let result: WasteAnnualTourTransferResult | undefined;
    let response: Response;
    try {
      result = await requireDeps(
        deps.createWasteAnnualTourTransfer,
        'createWasteAnnualTourTransfer'
      )({ instanceId, create: parsed.data });
      response = jsonItemResponse(201, result, requestId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) throw error;
      response =
        toDomainErrorResponse(error, requestId) ??
        createApiError(
          503,
          'database_unavailable',
          'Der Tourensatz konnte nicht vollständig angelegt werden.',
          requestId
        );
    }

    return completeAnnualTourTransfer({
      instanceId,
      actorAccountId,
      idempotencyKey: idempotencyKey.key,
      create: parsed.data,
      result,
      response,
      deps,
      ctx,
    });
  },
};
