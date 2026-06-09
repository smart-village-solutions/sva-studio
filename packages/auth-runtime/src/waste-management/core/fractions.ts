import { randomUUID } from 'node:crypto';

import { wasteManagementOperationsContract } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { resolveActorInfo } from '../../iam-account-management/shared.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteFractionSchema, updateWasteFractionSchema } = wasteManagementMasterDataSchemas;
const normalizeWasteFractionShortLabel = (value: string): string => value.trim().toUpperCase();

const enqueueWasteTypesSyncAfterFractionMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  instanceId: string
): Promise<void> => {
  const actorResolution = await (deps.resolveActorInfo ??
    ((scopedRequest: Request, scopedCtx: AuthenticatedRequestContext) =>
      resolveActorInfo(scopedRequest, scopedCtx, { requireActorMembership: true })))(request, ctx);
  if ('error' in actorResolution || !actorResolution.actor.actorAccountId) {
    return;
  }

  await (deps.startPluginOperationJob ?? startPluginOperationJobFromFacade)({
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
};

const normalizeWasteFractionReminderConfig = (input: {
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

export const wasteManagementFractionHandlers = {
  createWasteManagementFractionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, createWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }
    const reminderConfig = normalizeWasteFractionReminderConfig(parsed.data);

    const response = await runWasteCreateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.fraction.created',
        resourceType: 'waste_fraction',
      },
      messages: {
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
          id: parsed.data.id,
          name: parsed.data.name.trim(),
          pdfShortLabel: normalizeWasteFractionShortLabel(parsed.data.pdfShortLabel),
          translations: parsed.data.translations,
          containerSize: normalizeOptionalString(parsed.data.containerSize),
          color: parsed.data.color,
          description: normalizeOptionalString(parsed.data.description),
          active: parsed.data.active,
          reminderCount: reminderConfig.reminderCount,
          firstReminderMaxLeadDays: reminderConfig.firstReminderMaxLeadDays,
          secondReminderMaxLeadDays: reminderConfig.secondReminderMaxLeadDays,
          reminderChannelPushEnabled: reminderConfig.reminderChannelPushEnabled,
          reminderChannelEmailEnabled: reminderConfig.reminderChannelEmailEnabled,
          reminderChannelCalendarEnabled: reminderConfig.reminderChannelCalendarEnabled,
        }),
      loadSaved: () => requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, parsed.data.id),
    });

    if (response.status < 400) {
      await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
    }

    return response;
  },
  updateWasteManagementFractionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const fractionId = readPathSegment(request, 4)?.trim();
    if (!fractionId) {
      return createApiError(400, 'invalid_request', 'fractionId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }
    const reminderConfig = normalizeWasteFractionReminderConfig(parsed.data);

    const loadWasteFraction = requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById');

    const response = await runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: fractionId,
      audit: {
        actionId: 'waste-management.fraction.updated',
        resourceType: 'waste_fraction',
      },
      messages: {
        notFound: 'Die Waste-Fraktion wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadWasteFraction(instanceId, fractionId),
      save: () =>
        requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
          id: fractionId,
          name: parsed.data.name.trim(),
          pdfShortLabel: normalizeWasteFractionShortLabel(parsed.data.pdfShortLabel),
          translations: parsed.data.translations,
          containerSize: normalizeOptionalString(parsed.data.containerSize),
          color: parsed.data.color,
          description: normalizeOptionalString(parsed.data.description),
          active: parsed.data.active,
          reminderCount: reminderConfig.reminderCount,
          firstReminderMaxLeadDays: reminderConfig.firstReminderMaxLeadDays,
          secondReminderMaxLeadDays: reminderConfig.secondReminderMaxLeadDays,
          reminderChannelPushEnabled: reminderConfig.reminderChannelPushEnabled,
          reminderChannelEmailEnabled: reminderConfig.reminderChannelEmailEnabled,
          reminderChannelCalendarEnabled: reminderConfig.reminderChannelCalendarEnabled,
        }),
      loadSaved: () => loadWasteFraction(instanceId, fractionId),
    });

    if (response.status < 400) {
      await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
    }

    return response;
  },
  deleteWasteManagementFractionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const fractionId = readPathSegment(request, 4)?.trim();
    if (!fractionId) {
      return createApiError(400, 'invalid_request', 'fractionId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    try {
      const existing = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, fractionId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Fraktion wurde nicht gefunden.', requestId);
      }

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
      await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
      return new Response(JSON.stringify(asApiItem({ id: fractionId }, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      const isConflict = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503';
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
      return isConflict
        ? createApiError(409, 'invalid_request', 'Die Waste-Fraktion kann wegen bestehender Zuordnungen nicht gelöscht werden.', requestId)
        : createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht gelöscht werden.', requestId);
    }
  },
};
