import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import { isResponse, json, parseDetachLinkedContent } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { EVENTS_CONTENT_TYPE, pluginActionFor, type RouteMatch } from './events-route-access.js';
import { parseEventInput } from './events-route-input.js';
import { createContentMutationHandler } from './events-route-workflow.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  recordCreatedMainserverDataProvider,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
} from './mutation-principal.js';
import {
  changeSvaMainserverEventVisibility,
  createSvaMainserverEvent,
  deleteSvaMainserverEvent,
  getSvaMainserverEventDetail,
  updateSvaMainserverEvent,
} from './service.js';

const toEventVisibilityPartialFailureResponse = (
  error: unknown,
  event: Record<string, unknown>,
  operation: 'erstellt' | 'aktualisiert'
): Response => {
  const status = error instanceof SvaMainserverError ? error.statusCode : 502;
  const message =
    operation === 'erstellt'
      ? 'Der Event wurde erstellt, aber die Sichtbarkeit konnte nicht aktualisiert werden. Erneutes Speichern kann zu Duplikaten führen.'
      : 'Der Event wurde aktualisiert, aber die Sichtbarkeit konnte nicht aktualisiert werden. Erneutes Speichern kann zu abweichender Sichtbarkeit führen.';

  return json(
    {
      error: 'invalid_response',
      message,
      partialSuccess: true,
      data: event,
    },
    status
  );
};

export const handleCollectionCreate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'collection' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  return createContentMutationHandler({
    route,
    action: 'create',
    requestId,
    parse: async (inputRequest) => await parseEventInput(inputRequest),
    execute: async (actor, parsed) => {
      const principalAuthorization = await authorizeMainserverCreateForPrincipal({
        actor,
        action: pluginActionFor(route.contentKind, 'create'),
        contentType: EVENTS_CONTENT_TYPE,
      });
      if (isResponse(principalAuthorization)) return principalAuthorization;
      const result = await createSvaMainserverEvent({ ...actor, event: parsed.event });
      const bindingResult = await recordCreatedMainserverDataProvider({
        actor,
        created: result,
        reread: async () =>
          (await getSvaMainserverEventDetail({ ...actor, eventId: result.id })).data,
        contentType: EVENTS_CONTENT_TYPE,
      });
      if (parsed.visible === false) {
        try {
          await changeSvaMainserverEventVisibility({
            ...actor,
            eventId: result.id,
            visible: false,
          });
        } catch (error) {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'reconciliation_required',
            completedSteps: ['provider_write'],
            contentId: result.id,
            observedDataProviderId: result.dataProvider?.id ?? bindingResult.observedDataProviderId,
            lastErrorCode: error instanceof SvaMainserverError ? error.code : 'visibility_failed',
          });
          return toEventVisibilityPartialFailureResponse(
            error,
            { ...result, visible: false },
            'erstellt'
          );
        }
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus:
          bindingResult.outcome === 'conflict' ||
          bindingResult.outcome === 'reconciliation_required'
            ? 'reconciliation_required'
            : 'complete',
        completedSteps: ['provider_write', 'binding_observation'],
        contentId: result.id,
        observedDataProviderId: result.dataProvider?.id ?? bindingResult.observedDataProviderId,
      });
      logSuccess(`mainserver_${route.contentKind}_create`, result.id);
      return json(
        {
          data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible },
          ...(bindingResult.outcome === 'conflict' ||
          bindingResult.outcome === 'reconciliation_required'
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      );
    },
  })(request, ctx);
};

export const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  return createContentMutationHandler({
    route,
    action: 'update',
    requestId,
    parse: async (inputRequest) => await parseEventInput(inputRequest),
    execute: async (actor, parsed) => {
      const existing = await getSvaMainserverEventDetail({ ...actor, eventId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(route.contentKind, 'update'),
        contentType: EVENTS_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing.data,
        additionalActions: toMainserverAdditionalActions(
          resolveMainserverVisibilityAction(existing.data.visible, parsed.visible)
        ),
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const result = await updateSvaMainserverEvent({
        ...actor,
        eventId: route.itemId,
        event: parsed.event,
      });
      if (parsed.visible !== undefined) {
        try {
          await changeSvaMainserverEventVisibility({
            ...actor,
            eventId: route.itemId,
            visible: parsed.visible,
          });
        } catch (error) {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'reconciliation_required',
            completedSteps: ['provider_write'],
            contentId: route.itemId,
            observedDataProviderId: existing.data?.dataProvider?.id,
            lastErrorCode: error instanceof SvaMainserverError ? error.code : 'visibility_failed',
          });
          return toEventVisibilityPartialFailureResponse(
            error,
            { ...result, visible: parsed.visible },
            'aktualisiert'
          );
        }
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: route.itemId,
        observedDataProviderId: existing.data?.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_update`, route.itemId);
      return json({
        data: parsed.visible === undefined ? result : { ...result, visible: parsed.visible },
      });
    },
  })(request, ctx);
};

export const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const detachLinkedContent = parseDetachLinkedContent(request);
  if (isResponse(detachLinkedContent)) return detachLinkedContent;
  return createContentMutationHandler({
    route,
    action: 'delete',
    requestId,
    parse: async () => ({ itemId: route.itemId }),
    execute: async (actor) => {
      const existing = await getSvaMainserverEventDetail({ ...actor, eventId: route.itemId });
      const providerAuthorization = await authorizeMainserverExistingContent({
        actor,
        action: pluginActionFor(route.contentKind, 'delete'),
        contentType: EVENTS_CONTENT_TYPE,
        contentId: route.itemId,
        item: existing.data,
      });
      if (isResponse(providerAuthorization)) return providerAuthorization;
      const data = await deleteSvaMainserverEvent({
        ...actor,
        eventId: route.itemId,
        detachLinkedContent,
      });
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: route.itemId,
        observedDataProviderId: existing.data?.dataProvider?.id,
      });
      logSuccess(`mainserver_${route.contentKind}_delete`, route.itemId);
      return json({ data });
    },
  })(request, ctx);
};
