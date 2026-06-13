import type { WasteFractionRecord } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { emitWasteAuditEvent } from './auth.js';
import {
  createWasteFractionMutationResponse,
  enqueueWasteTypesSyncAfterFractionMutation,
  normalizeWasteFractionReminderConfig,
  normalizeWasteFractionShortLabel,
  validateUniqueActiveWasteFractionShortLabel,
  withWasteFractionSyncMetadata,
} from './fractions-support.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteFractionSchema, updateWasteFractionSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementFractionHandlers = {
  createWasteManagementFractionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

    const parsed = await parseRequestBody(request, createWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }
    const normalizedShortLabel = normalizeWasteFractionShortLabel(parsed.data.pdfShortLabel);
    const duplicateShortLabelError = await validateUniqueActiveWasteFractionShortLabel(
      deps,
      instanceId,
      normalizedShortLabel,
      parsed.data.active,
      requestId
    );
    if (duplicateShortLabelError) {
      return duplicateShortLabelError;
    }
    const reminderConfig = normalizeWasteFractionReminderConfig(parsed.data.reminderConfig);

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
          pdfShortLabel: normalizedShortLabel,
          translations: parsed.data.translations,
          containerSize: normalizeOptionalString(parsed.data.containerSize),
          color: parsed.data.color,
          description: normalizeOptionalString(parsed.data.description),
          active: parsed.data.active,
          reminderConfig,
        }),
      loadSaved: () => requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, parsed.data.id),
    });

    if (response.status >= 400) {
      return response;
    }

    const syncMetadata = await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
    return await withWasteFractionSyncMetadata<WasteFractionRecord>(response, syncMetadata);
  },
  updateWasteManagementFractionInternal: async (
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

    const parsed = await parseRequestBody(request, updateWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }
    const normalizedShortLabel = normalizeWasteFractionShortLabel(parsed.data.pdfShortLabel);
    const reminderConfig = normalizeWasteFractionReminderConfig(parsed.data.reminderConfig);

    const loadWasteFraction = requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById');
    const existing = await loadWasteFraction(instanceId, fractionId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Fraktion wurde nicht gefunden.', requestId);
    }
    const duplicateShortLabelError = await validateUniqueActiveWasteFractionShortLabel(
      deps,
      instanceId,
      normalizedShortLabel,
      parsed.data.active,
      requestId,
      fractionId
    );
    if (duplicateShortLabelError) {
      return duplicateShortLabelError;
    }

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
      loadExisting: async () => existing,
      save: () =>
        requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
          id: fractionId,
          name: parsed.data.name.trim(),
          pdfShortLabel: normalizedShortLabel,
          translations: parsed.data.translations,
          containerSize: normalizeOptionalString(parsed.data.containerSize),
          color: parsed.data.color,
          description: normalizeOptionalString(parsed.data.description),
          active: parsed.data.active,
          reminderConfig,
        }),
      loadSaved: () => loadWasteFraction(instanceId, fractionId),
    });

    if (response.status >= 400) {
      return response;
    }

    const syncMetadata = await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
    return await withWasteFractionSyncMetadata<WasteFractionRecord>(response, syncMetadata);
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
      const syncMetadata = await enqueueWasteTypesSyncAfterFractionMutation(request, ctx, deps, instanceId);
      return createWasteFractionMutationResponse(200, { id: fractionId }, requestId, syncMetadata);
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
