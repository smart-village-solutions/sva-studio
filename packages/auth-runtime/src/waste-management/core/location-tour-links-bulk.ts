import { type WasteLocationTourLinkBulkCreateResult } from '@sva/core';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteLocationTourLinksBulkSchema } = wasteManagementTourSchemas;

export const wasteManagementLocationTourLinkBulkHandlers = {
  createWasteManagementLocationTourLinksBulkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.tours.manage',
      deps,
      requestId
    );
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

    const parsed = await parseRequestBody(
      request,
      createWasteLocationTourLinksBulkSchema.superRefine((value, refinementCtx) => {
        const normalizedLocationIds = value.locationIds.map((entry) => entry.trim());
        if (new Set(normalizedLocationIds).size !== normalizedLocationIds.length) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'locationIds dürfen keine Duplikate enthalten.',
            path: ['locationIds'],
          });
        }
      })
    );
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const items = await requireDeps(
        deps.saveWasteLocationTourLinksBulk,
        'saveWasteLocationTourLinksBulk'
      )(instanceId, {
        locationIds: parsed.data.locationIds.map((entry) => entry.trim()),
        tourId: parsed.data.tourId,
      });

      const result: WasteLocationTourLinkBulkCreateResult = {
        items,
        createdCount: items.length,
      };

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.bulk-created',
        result: 'success',
        resourceType: 'waste_location_tour_link_batch',
        resourceId: parsed.data.tourId,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(result, requestId)), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.bulk-created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_location_tour_link_batch',
        resourceId: parsed.data.tourId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Tour-Zuordnungen konnten nicht gesammelt gespeichert werden.',
        requestId
      );
    }
  },
};
