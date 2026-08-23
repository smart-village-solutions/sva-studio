import {
  buildWasteAnnualTourTransferFingerprint,
  type WasteAnnualTourTransferCreateInput,
  type WasteAnnualTourTransferPreview,
  type WasteAnnualTourTransferResult,
} from '@sva/core';

import { completeIdempotency, reserveIdempotency } from '../../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError } from '../../shared/request-helpers.js';
import { emitWasteAuditEvent } from './auth.js';
import type { WasteManagementHandlerDeps } from './types.js';

export const annualTourTransferEndpoint = 'POST:/api/v1/waste-management/tours/annual-transfer';

export const reserveAnnualTourTransfer = async (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  create: WasteAnnualTourTransferCreateInput;
  requestId?: string;
}): Promise<Response | null> => {
  const reservation = await reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: annualTourTransferEndpoint,
    idempotencyKey: input.idempotencyKey,
    payloadHash: await buildWasteAnnualTourTransferFingerprint(input.create),
  });
  if (reservation.status === 'replay') {
    return new Response(JSON.stringify(reservation.responseBody), {
      status: reservation.responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (reservation.status === 'conflict') {
    return createApiError(
      409,
      reservation.reason === 'in_progress' ? 'idempotency_in_progress' : 'idempotency_key_reuse',
      reservation.message,
      input.requestId
    );
  }
  return null;
};

export const completeAnnualTourTransfer = async (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  create: WasteAnnualTourTransferCreateInput;
  result?: WasteAnnualTourTransferResult;
  response: Response;
  deps: WasteManagementHandlerDeps;
  ctx: AuthenticatedRequestContext;
}): Promise<Response> => {
  const responseBody = await input.response.clone().json();
  const updatedPreview = (
    responseBody as {
      error?: { details?: { updatedPreview?: WasteAnnualTourTransferPreview } };
    }
  ).error?.details?.updatedPreview;
  const classificationCounts = input.result?.classificationCounts ?? updatedPreview?.summary;
  await completeIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: annualTourTransferEndpoint,
    idempotencyKey: input.idempotencyKey,
    status: input.response.ok ? 'COMPLETED' : 'FAILED',
    responseStatus: input.response.status,
    responseBody,
  });
  await emitWasteAuditEvent({
    deps: input.deps,
    ctx: input.ctx,
    instanceId: input.instanceId,
    actionId: 'waste-management.annual-tour-transfer.created',
    result: input.response.ok ? 'success' : 'failure',
    reasonCode: input.response.ok
      ? undefined
      : ((responseBody as { error?: { code?: string } }).error?.code ?? 'failed'),
    resourceType: 'waste_annual_tour_transfer',
    batchSummary: {
      sourceYear: input.create.sourceYear,
      targetYear: input.create.sourceYear + 1,
      transferableCount: classificationCounts?.transferable,
      alreadyEffectiveCount: classificationCounts?.alreadyEffective,
      blockedCount: classificationCounts?.blocked,
      createdCount: input.result?.createdCount ?? 0,
      existingCount: input.result?.existingCount ?? 0,
      resourceIds: [
        ...(input.result?.createdTourIds ?? []),
        ...(input.result?.existingTourIds ?? []),
      ],
    },
  });
  return input.response;
};
