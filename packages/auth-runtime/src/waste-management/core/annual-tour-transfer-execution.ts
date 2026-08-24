import type {
  WasteAnnualTourTransferCreateInput,
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/core';

import {
  completeIdempotency,
  hasIdempotentAuditEvent,
} from '../../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { emitWasteAuditEvent } from './auth.js';
import { annualTourTransferEndpoint } from './annual-tour-transfer-idempotency.js';
import type { WasteManagementHandlerDeps } from './types.js';

export const completeAnnualTourTransfer = async (input: {
  instanceId: string;
  actorAccountId: string;
  idempotencyKey: string;
  create: WasteAnnualTourTransferCreateInput;
  result?: WasteAnnualTourTransferResult;
  response: Response;
  leaseToken: string;
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
  const auditEvent = {
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
  } as const;
  const auditExists = await hasIdempotentAuditEvent({
    instanceId: input.instanceId,
    idempotencyKey: input.idempotencyKey,
    eventType: input.response.ok ? 'plugin_action_authorized' : 'plugin_action_failed',
    actionId: auditEvent.actionId,
  });
  if (!auditExists) {
    await emitWasteAuditEvent({
      ...auditEvent,
      deps: input.deps,
      ctx: input.ctx,
      requestId: input.idempotencyKey,
    });
  }
  await completeIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: annualTourTransferEndpoint,
    idempotencyKey: input.idempotencyKey,
    status: input.response.ok ? 'COMPLETED' : 'FAILED',
    responseStatus: input.response.status,
    responseBody,
    leaseToken: input.leaseToken,
  });
  return input.response;
};
