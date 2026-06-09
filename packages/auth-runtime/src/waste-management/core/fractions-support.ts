import { randomUUID } from 'node:crypto';

import type { ApiItemResponse, StudioJobRecord, WasteFractionRecord } from '@sva/core';
import { wasteManagementOperationsContract } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { resolveActorInfo } from '../../iam-account-management/shared.js';
import { asApiItem, createApiError } from '../../shared/request-helpers.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireDeps } from './utils.js';

type WasteFractionSyncStatus = 'queued' | 'failed';

type WasteFractionSyncMetadata = Readonly<{
  syncStatus?: WasteFractionSyncStatus;
  syncJob?: StudioJobRecord;
}>;

type WasteFractionMutationApiResponse<T> = ApiItemResponse<T> & WasteFractionSyncMetadata;

export const normalizeWasteFractionShortLabel = (value: string): string => value.trim().toUpperCase();

export const withWasteFractionSyncMetadata = async <T>(
  response: Response,
  syncMetadata: WasteFractionSyncMetadata
): Promise<Response> => {
  const payload = (await response.json()) as ApiItemResponse<T>;

  return new Response(
    JSON.stringify({
      ...payload,
      ...(syncMetadata.syncStatus ? { syncStatus: syncMetadata.syncStatus } : {}),
      ...(syncMetadata.syncJob ? { syncJob: syncMetadata.syncJob } : {}),
    } satisfies WasteFractionMutationApiResponse<T>),
    {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const createWasteFractionMutationResponse = <T>(
  status: number,
  data: T,
  requestId: string | undefined,
  syncMetadata: WasteFractionSyncMetadata
): Response =>
  new Response(
    JSON.stringify({
      ...asApiItem(data, requestId),
      ...(syncMetadata.syncStatus ? { syncStatus: syncMetadata.syncStatus } : {}),
      ...(syncMetadata.syncJob ? { syncJob: syncMetadata.syncJob } : {}),
    } satisfies WasteFractionMutationApiResponse<T>),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );

const findConflictingActiveFraction = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  shortLabel: string,
  currentFractionId?: string
): Promise<WasteFractionRecord | null> => {
  const overview = await requireDeps(deps.loadMasterDataFractionsOverview, 'loadMasterDataFractionsOverview')(instanceId);

  return (
    overview.fractions.find((fraction) => {
      if (!fraction.active || fraction.id === currentFractionId) {
        return false;
      }

      return normalizeWasteFractionShortLabel(fraction.pdfShortLabel ?? '') === shortLabel;
    }) ?? null
  );
};

export const validateUniqueActiveWasteFractionShortLabel = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  shortLabel: string,
  active: boolean,
  requestId?: string,
  currentFractionId?: string
): Promise<Response | null> => {
  if (!active) {
    return null;
  }

  const conflictingFraction = await findConflictingActiveFraction(deps, instanceId, shortLabel, currentFractionId);
  if (!conflictingFraction) {
    return null;
  }

  return createApiError(
    409,
    'conflict',
    `Das PDF-Kürzel "${shortLabel}" wird bereits von der aktiven Waste-Fraktion "${conflictingFraction.name}" verwendet.`,
    requestId
  );
};

export const enqueueWasteTypesSyncAfterFractionMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<WasteFractionSyncMetadata> => {
  const actorResolution = await (deps.resolveActorInfo ??
    ((scopedRequest: Request, scopedCtx: AuthenticatedRequestContext) =>
      resolveActorInfo(scopedRequest, scopedCtx, { requireActorMembership: true })))(request, ctx);
  if ('error' in actorResolution || !actorResolution.actor.actorAccountId) {
    return { syncStatus: 'failed' };
  }

  const response = await (deps.startPluginOperationJob ?? startPluginOperationJobFromFacade)({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
    idempotencyKey: `waste-sync:${instanceId}:${randomUUID()}`,
    requestId: actorResolution.actor.requestId ?? getRequestId(deps),
    scheduledAt: new Date().toISOString(),
    data: {
      pluginId: wasteManagementOperationsContract.pluginId,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      input: {
        operation: 'sync-waste-types',
        keycloakSubject: ctx.user.id,
        activeOrganizationId: ctx.activeOrganizationId,
      },
    },
  });

  if (!response.ok) {
    return { syncStatus: 'failed' };
  }

  try {
    const payload = (await response.json()) as ApiItemResponse<StudioJobRecord>;
    if (!payload.data?.id) {
      return { syncStatus: 'failed' };
    }

    return {
      syncStatus: 'queued',
      syncJob: payload.data,
    };
  } catch {
    return { syncStatus: 'failed' };
  }
};

export const normalizeWasteFractionReminderConfig = (input: {
  readonly reminderCount: 'none' | 'once' | 'twice';
  readonly firstReminderMaxLeadDays?: number;
  readonly secondReminderMaxLeadDays?: number;
  readonly reminderChannelPushEnabled: boolean;
  readonly reminderChannelEmailEnabled: boolean;
  readonly reminderChannelCalendarEnabled: boolean;
}) => {
  if (input.reminderCount === 'none') {
    return {
      reminderCount: 'none' as const,
      firstReminderMaxLeadDays: undefined,
      secondReminderMaxLeadDays: undefined,
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: false,
      reminderChannelCalendarEnabled: false,
    };
  }

  if (input.reminderCount === 'once') {
    return {
      reminderCount: 'once' as const,
      firstReminderMaxLeadDays: input.firstReminderMaxLeadDays,
      secondReminderMaxLeadDays: undefined,
      reminderChannelPushEnabled: input.reminderChannelPushEnabled,
      reminderChannelEmailEnabled: input.reminderChannelEmailEnabled,
      reminderChannelCalendarEnabled: input.reminderChannelCalendarEnabled,
    };
  }

  return {
    reminderCount: 'twice' as const,
    firstReminderMaxLeadDays: input.firstReminderMaxLeadDays,
    secondReminderMaxLeadDays: input.secondReminderMaxLeadDays,
    reminderChannelPushEnabled: input.reminderChannelPushEnabled,
    reminderChannelEmailEnabled: input.reminderChannelEmailEnabled,
    reminderChannelCalendarEnabled: input.reminderChannelCalendarEnabled,
  };
};
