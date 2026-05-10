import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteLocationTourLinkSchema, updateWasteLocationTourLinkSchema } = wasteManagementTourSchemas;

const toLocationTourLinkInput = (
  id: string,
  data: {
    locationId: string;
    tourId: string;
    startDate?: string;
    endDate?: string;
  }
) => ({
  id,
  locationId: data.locationId,
  tourId: data.tourId,
  startDate: normalizeOptionalString(data.startDate),
  endDate: normalizeOptionalString(data.endDate),
});

export const wasteManagementLocationTourLinkHandlers = {
  createWasteManagementLocationTourLinkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, createWasteLocationTourLinkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink')(
        instanceId,
        toLocationTourLinkInput(parsed.data.id, parsed.data)
      );

      const saved = await requireDeps(deps.loadWasteLocationTourLinkById, 'loadWasteLocationTourLinkById')(
        instanceId,
        parsed.data.id
      );
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.location-tour-link.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_location_tour_link',
          resourceId: parsed.data.id,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.created',
        result: 'success',
        resourceType: 'waste_location_tour_link',
        resourceId: saved.id,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(saved, requestId)), {
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
        actionId: 'waste-management.location-tour-link.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_location_tour_link',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
  updateWasteManagementLocationTourLinkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const linkId = readPathSegment(request, 4)?.trim();
    if (!linkId) {
      return createApiError(400, 'invalid_request', 'linkId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteLocationTourLinkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const loadLocationTourLink = requireDeps(deps.loadWasteLocationTourLinkById, 'loadWasteLocationTourLinkById');
      const saveLocationTourLink = requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink');
      const existing = await loadLocationTourLink(instanceId, linkId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Tour-Zuordnung wurde nicht gefunden.', requestId);
      }

      await saveLocationTourLink(instanceId, toLocationTourLinkInput(linkId, parsed.data));

      const saved = await loadLocationTourLink(instanceId, linkId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.location-tour-link.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_location_tour_link',
          resourceId: linkId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.updated',
        result: 'success',
        resourceType: 'waste_location_tour_link',
        resourceId: saved.id,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(saved, requestId)), {
        status: 200,
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
        actionId: 'waste-management.location-tour-link.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_location_tour_link',
        resourceId: linkId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
};
