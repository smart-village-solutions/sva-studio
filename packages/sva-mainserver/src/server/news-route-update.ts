import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';
import { isResponse, json, parseDetachLinkedContent } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { authorizeOrResponse, NEWS_CONTENT_TYPE, type RouteMatch } from './news-route-access.js';
import { parseAuthorizedNewsInput, parseVisibilityInput } from './news-route-input.js';
import { preserveExistingNewsMetadata } from './news-route-metadata.js';
import { createNewsItemMutationHandler, emitNewsAuditEvent } from './news-route-workflow.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
} from './mutation-principal.js';
import {
  changeSvaMainserverNewsVisibility,
  deleteSvaMainserverNews,
  getSvaMainserverNews,
  updateSvaMainserverNews,
} from './service.js';
import type { SvaMainserverNewsInput } from '../types.js';

export const handleItemUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  return createNewsItemMutationHandler({
    route,
    action: 'news.update',
    requestId,
    parse: async (inputRequest) =>
      await parseAuthorizedNewsInput(inputRequest, ctx, { allowPushNotification: true }),
    execute: async (actor, parsed) => {
      let response: Response;
      if (parsed.news.pushNotification === true) {
        const pushAuthorization = await authorizeOrResponse(
          ctx,
          'news.pushNotification',
          route.newsId
        );
        if (isResponse(pushAuthorization)) return pushAuthorization;
      }
      try {
        const existing = await getSvaMainserverNews({ ...actor, newsId: route.newsId });
        const providerAuthorization = await authorizeMainserverExistingContent({
          actor,
          action: 'news.update',
          contentType: NEWS_CONTENT_TYPE,
          contentId: route.newsId,
          item: existing,
          additionalActions: toMainserverAdditionalActions(
            resolveMainserverVisibilityAction(existing.visible, parsed.visible)
          ),
        });
        if (isResponse(providerAuthorization)) return providerAuthorization;
        response = await updateNewsForRoute(
          { kind: 'item', newsId: route.newsId },
          actor,
          preserveExistingNewsMetadata(parsed.news, existing),
          parsed.visible
        );
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write'],
          contentId: route.newsId,
          observedDataProviderId: existing.dataProvider?.id,
        });
      } catch (error) {
        await finalizeMainserverMutationFailure({
          actor,
          error,
          contentId: route.newsId,
        });
        await emitNewsAuditEvent({
          ctx,
          instanceId: actor.instanceId,
          actionId: 'news.update',
          result: 'failure',
          newsId: route.newsId,
          reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
        });
        if (parsed.news.pushNotification === true) {
          await emitNewsAuditEvent({
            ctx,
            instanceId: actor.instanceId,
            actionId: 'news.pushNotification',
            result: 'failure',
            newsId: route.newsId,
            reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
          });
        }
        throw error;
      }
      await emitNewsAuditEvent({
        ctx,
        instanceId: actor.instanceId,
        actionId: 'news.update',
        result: 'success',
        newsId: route.newsId,
      });
      if (parsed.news.pushNotification === true) {
        await emitNewsAuditEvent({
          ctx,
          instanceId: actor.instanceId,
          actionId: 'news.pushNotification',
          result: 'success',
          newsId: route.newsId,
        });
      }
      logSuccess('mainserver_news_update', route.newsId);
      return response;
    },
  })(request, ctx);
};

export const handleItemDelete = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'item' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  const detachLinkedContent = parseDetachLinkedContent(request);
  if (isResponse(detachLinkedContent)) return detachLinkedContent;
  return createNewsItemMutationHandler({
    route,
    action: 'news.delete',
    requestId,
    parse: async () => ({ newsId: route.newsId }),
    execute: async (actor) => {
      let response: Response;
      try {
        const existing = await getSvaMainserverNews({ ...actor, newsId: route.newsId });
        const providerAuthorization = await authorizeMainserverExistingContent({
          actor,
          action: 'news.delete',
          contentType: NEWS_CONTENT_TYPE,
          contentId: route.newsId,
          item: existing,
        });
        if (isResponse(providerAuthorization)) return providerAuthorization;
        response = await deleteNewsForRoute(
          { kind: 'item', newsId: route.newsId },
          actor,
          detachLinkedContent
        );
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write', 'tombstone'],
          contentId: route.newsId,
          observedDataProviderId: existing.dataProvider?.id,
        });
      } catch (error) {
        await finalizeMainserverMutationFailure({
          actor,
          error,
          contentId: route.newsId,
        });
        await emitNewsAuditEvent({
          ctx,
          instanceId: actor.instanceId,
          actionId: 'news.delete',
          result: 'failure',
          newsId: route.newsId,
          reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
        });
        throw error;
      }
      await emitNewsAuditEvent({
        ctx,
        instanceId: actor.instanceId,
        actionId: 'news.delete',
        result: 'success',
        newsId: route.newsId,
      });
      logSuccess('mainserver_news_delete', route.newsId);
      return response;
    },
  })(request, ctx);
};

export const handleVisibilityUpdate = async (
  request: Request,
  route: Extract<RouteMatch, { readonly kind: 'itemVisibility' }>,
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined,
  logSuccess: (operation: string, newsId?: string) => void
) => {
  return createNewsItemMutationHandler({
    route,
    action: 'news.update',
    requestId,
    parse: async (inputRequest) => await parseVisibilityInput(inputRequest),
    execute: async (actor, parsed) => {
      let response: Response;
      try {
        const existing = await getSvaMainserverNews({ ...actor, newsId: route.newsId });
        const providerAuthorization = await authorizeMainserverExistingContent({
          actor,
          action: 'news.update',
          contentType: NEWS_CONTENT_TYPE,
          contentId: route.newsId,
          item: existing,
          additionalActions: toMainserverAdditionalActions(
            resolveMainserverVisibilityAction(existing.visible, parsed.visible)
          ),
        });
        if (isResponse(providerAuthorization)) return providerAuthorization;
        response = await changeNewsVisibilityForRoute(route, actor, parsed.visible);
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write'],
          contentId: route.newsId,
          observedDataProviderId: existing.dataProvider?.id,
        });
      } catch (error) {
        await finalizeMainserverMutationFailure({
          actor,
          error,
          contentId: route.newsId,
        });
        await emitNewsAuditEvent({
          ctx,
          instanceId: actor.instanceId,
          actionId: 'news.visibility.update',
          result: 'failure',
          newsId: route.newsId,
          reasonCode: error instanceof SvaMainserverError ? error.code : 'internal_error',
        });
        throw error;
      }
      await emitNewsAuditEvent({
        ctx,
        instanceId: actor.instanceId,
        actionId: 'news.visibility.update',
        result: 'success',
        newsId: route.newsId,
      });
      logSuccess('mainserver_news_visibility_update', route.newsId);
      return response;
    },
  })(request, ctx);
};

const updateNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  },
  news: SvaMainserverNewsInput,
  visible?: boolean
) => {
  const data = await updateSvaMainserverNews({ ...actor, newsId: route.newsId, news });
  if (visible !== undefined) {
    await changeSvaMainserverNewsVisibility({ ...actor, newsId: route.newsId, visible });
  }
  return json({ data: visible === undefined ? data : { ...data, visible } });
};

const changeNewsVisibilityForRoute = async (
  route: Extract<RouteMatch, { kind: 'itemVisibility' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  },
  visible: boolean
) => {
  await changeSvaMainserverNewsVisibility({ ...actor, newsId: route.newsId, visible });
  return json({ data: { id: route.newsId, visible } });
};

const deleteNewsForRoute = async (
  route: Extract<RouteMatch, { kind: 'item' }>,
  actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  },
  detachLinkedContent: boolean
) => {
  const data = await deleteSvaMainserverNews({
    ...actor,
    newsId: route.newsId,
    detachLinkedContent,
  });
  return json({ data });
};
