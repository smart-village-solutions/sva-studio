import {
  listExternalContentReferences,
  loadExternalContentCore,
  loadExternalContentReferenceByContentId,
  updateExternalContentCore,
  updateExternalContentReconciliationStatus,
  withAuthenticatedUser,
  withExternalContentMutationLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverGenericItem } from '../types.js';
import {
  errorJson,
  isResponse,
  json,
  matchRequestRoute,
  type RouteMatch,
} from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  resolveMainserverLifecycleAction,
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  resolveMainserverResourceActor,
  toMainserverAdditionalActions,
} from './mutation-principal.js';
import {
  PROJECTS_CONTENT_TYPE,
  PROJECTS_GENERIC_TYPE,
  mergeProjectIntoGenericItem,
  parseProjectInput,
} from './projects-contract.js';
import {
  mapProjectRead,
  projectPayload,
  publishedAtForProject,
} from './projects-create-mapping.js';
import { createProject } from './projects-create.js';
import { listAllActiveProjectItems } from './projects-listing.js';
import {
  authorizeProjectOrResponse,
  projectActorInfoOrResponse,
  requireProjectCsrf,
} from './projects-route-authorization.js';
import { projectMutationJson, projectSourceReferenceInput } from './projects-route-transport.js';
import {
  changeSvaMainserverGenericItemVisibility,
  deleteSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
  listSvaMainserverGenericItems,
  updateSvaMainserverGenericItem,
} from './service.js';

const PROJECTS_COLLECTION_PATH = '/api/v1/mainserver/projects';
const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

type ProjectRoute = RouteMatch<'projects'>;

const matchRoute = (request: Request): ProjectRoute | null =>
  matchRequestRoute(request, PROJECTS_COLLECTION_PATH, 'projects');

const loadProjectLocalContext = async (instanceId: string, contentId: string) => {
  const reference = await loadExternalContentReferenceByContentId({
    ...projectSourceReferenceInput(instanceId),
    contentId,
  }).catch(() => undefined);
  const loadedCore = reference
    ? await loadExternalContentCore(instanceId, reference.contentId).catch(() => undefined)
    : undefined;
  const core = loadedCore?.contentType === PROJECTS_CONTENT_TYPE ? loadedCore : undefined;
  return { core, reference };
};

const projectAuthorizationResource = (
  contentId: string,
  core: Awaited<ReturnType<typeof loadProjectLocalContext>>['core'],
  fallbackOwner: { readonly activeOrganizationId?: string; readonly actorAccountId: string }
) => {
  const owner = core
    ? {
        organizationId: core.organizationId,
        ownerUserId: core.ownerUserId,
        ownerOrganizationId: core.ownerOrganizationId,
      }
    : {
        organizationId: fallbackOwner.activeOrganizationId,
        ownerUserId: !fallbackOwner.activeOrganizationId ? fallbackOwner.actorAccountId : undefined,
        ownerOrganizationId: fallbackOwner.activeOrganizationId,
      };
  return {
    contentId,
    ...(owner.organizationId ? { organizationId: owner.organizationId } : {}),
    ...(owner.ownerUserId ? { ownerUserId: owner.ownerUserId } : {}),
    ...(owner.ownerOrganizationId ? { ownerOrganizationId: owner.ownerOrganizationId } : {}),
  };
};

const loadProjectContext = async (
  instanceId: string,
  keycloakSubject: string,
  contentId: string,
  activeOrganizationId?: string,
  localContext?: Awaited<ReturnType<typeof loadProjectLocalContext>>
) => {
  const { core, reference } =
    localContext ?? (await loadProjectLocalContext(instanceId, contentId));
  const genericItemId = reference?.sourceEntityId ?? contentId;
  let item: SvaMainserverGenericItem | undefined;
  try {
    item = await getSvaMainserverGenericItem({
      instanceId,
      keycloakSubject,
      ...(activeOrganizationId ? { activeOrganizationId } : {}),
      genericItemId,
    });
  } catch (error) {
    if (!(error instanceof SvaMainserverError) || error.code !== 'not_found') throw error;
  }
  if (!item) return undefined;
  if (item.genericType !== PROJECTS_GENERIC_TYPE) return undefined;
  return { core, reference, item };
};

const listProjects = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actor = await authorizeProjectOrResponse(ctx, 'projects.read');
  if (isResponse(actor)) return actor;
  const input = { ...actor, ...parseMainserverListQuery(request), includeInvisible: true };
  const upstream = await listAllActiveProjectItems(input, listSvaMainserverGenericItems);
  const references = await listExternalContentReferences(
    projectSourceReferenceInput(actor.instanceId)
  ).catch(() => []);
  const referenceBySourceId = new Map(
    references.flatMap((reference) =>
      reference.sourceEntityId && reference.reconciliationStatus === 'bound'
        ? [[reference.sourceEntityId, reference] as const]
        : []
    )
  );
  const projectEntries = upstream.data.flatMap((item) => {
    try {
      const project = mapProjectRead(item);
      const reference = referenceBySourceId.get(item.id);
      return [{ item, project: { ...project, id: reference?.contentId ?? project.id }, reference }];
    } catch (error) {
      logger.warn('Skipping FeaturedProject that violates the projection contract', {
        operation: 'mainserver_projects_list_upstream',
        instance_id: actor.instanceId,
        source_entity_id: item.id,
        error_code: error instanceof SvaMainserverError ? error.code : 'invalid_response',
      });
      return [];
    }
  });
  projectEntries.sort(
    (left, right) =>
      right.project.updatedAt.localeCompare(left.project.updatedAt) ||
      left.project.id.localeCompare(right.project.id)
  );
  const start = (input.page - 1) * input.pageSize;
  const data = projectEntries.slice(start, start + input.pageSize).map((entry) => {
    if (!entry.reference) return entry.project;
    try {
      const project = mapProjectRead(entry.item);
      return { ...project, id: entry.reference.contentId };
    } catch {
      return entry.project;
    }
  });
  logger.debug('Project list upstream pagination completed', {
    operation: 'mainserver_projects_list_upstream',
    upstream_page_count: upstream.observability.upstreamPageCount,
    upstream_item_count: upstream.observability.upstreamItemCount,
    matching_item_count: projectEntries.length,
  });
  return json({
    data,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage: start + input.pageSize < projectEntries.length,
      total: projectEntries.length,
    },
  });
};

const detailProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const localContext = await loadProjectLocalContext(instanceId, contentId);
  const actorInfo = await projectActorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const actor = await authorizeProjectOrResponse(
    ctx,
    'projects.read',
    projectAuthorizationResource(contentId, localContext.core, {
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
      actorAccountId: actorInfo.actorAccountId,
    })
  );
  if (isResponse(actor)) return actor;
  const context = await loadProjectContext(
    instanceId,
    ctx.user.id,
    contentId,
    actor.activeOrganizationId,
    localContext
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  const resourceActor = await resolveMainserverResourceActor({
    request,
    ctx,
    authorizedActor: actor,
  });
  const access = resourceActor
    ? await resolveMainserverResourceAccess({
        actor: resourceActor,
        actions: [
          'projects.update',
          'projects.delete',
          'content.publish',
          'content.changeStatus',
          'content.archive',
          'content.restore',
        ],
        contentId,
        contentType: PROJECTS_CONTENT_TYPE,
        item: context.item,
      })
    : {};
  const project = mapProjectRead(context.item);
  const data = { ...project, id: context.reference?.contentId ?? project.id };
  return json(resourceActor ? { data, meta: { access } } : { data });
};

const withProjectMutationLock = async <T>(input: {
  readonly instanceId: string;
  readonly lockKey: string;
  readonly execute: () => Promise<T>;
}): Promise<T> =>
  withExternalContentMutationLock({
    instanceId: input.instanceId,
    referenceId: input.lockKey,
    execute: input.execute,
  });

const updateProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const csrf = requireProjectCsrf(request);
  if (csrf) return csrf;
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const localContext = await loadProjectLocalContext(instanceId, contentId);
  const actorInfo = await projectActorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const authorizedActor = await authorizeProjectOrResponse(
    ctx,
    'projects.update',
    projectAuthorizationResource(contentId, localContext.core, {
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
      actorAccountId: actorInfo.actorAccountId,
    })
  );
  if (isResponse(authorizedActor)) return authorizedActor;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor });
  if (isResponse(actor)) return actor;
  const context = await loadProjectContext(
    instanceId,
    actor.keycloakSubject,
    contentId,
    actor.activeOrganizationId,
    localContext
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  const project = await parseProjectInput(request);
  if (isResponse(project)) return project;

  try {
    return await withProjectMutationLock({
      instanceId,
      lockKey: context.reference?.id ?? context.item.id,
      execute: async () => {
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.item.id,
        });
        if (freshItem.genericType !== PROJECTS_GENERIC_TYPE) {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const providerAuthorization = await authorizeMainserverExistingContent({
          actor,
          action: 'projects.update',
          contentType: PROJECTS_CONTENT_TYPE,
          contentId,
          item: freshItem,
          additionalActions: toMainserverAdditionalActions(
            resolveMainserverLifecycleAction(mapProjectRead(freshItem).status, project.status)
          ),
        });
        if (isResponse(providerAuthorization)) return providerAuthorization;
        const publishedAt = publishedAtForProject(project, freshItem.publishedAt);
        const updated = await updateSvaMainserverGenericItem({
          ...actor,
          genericItemId: freshItem.id,
          genericItem: mergeProjectIntoGenericItem({
            project,
            existing: freshItem,
            publishedAt,
          }),
        });
        await changeSvaMainserverGenericItemVisibility({
          ...actor,
          genericItemId: freshItem.id,
          visible: project.status === 'published',
        });
        let localFollowUpFailed = false;
        if (context.core && context.reference)
          try {
            await updateExternalContentCore({
              ...actorInfo,
              actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
              contentId,
              title: project.title,
              payload: projectPayload(project),
              status: project.status,
              publishedAt,
              authorDisplayMode: actor.mutationPrincipalContext.actingPrincipalType,
              authorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
            });
            await updateExternalContentReconciliationStatus({
              instanceId,
              referenceId: context.reference.id,
              status: 'bound',
            });
          } catch (error) {
            localFollowUpFailed = true;
            await Promise.resolve(
              updateExternalContentReconciliationStatus({
                instanceId,
                referenceId: context.reference.id,
                status: 'reconciliation_required',
                errorCode: 'local_finalize_failed',
              })
            ).catch(() => undefined);
            logger.warn('Project local follow-up failed after provider update', {
              operation: 'mainserver_projects_local_follow_up',
              instance_id: instanceId,
              error_code: error instanceof Error ? error.name : 'local_finalize_failed',
            });
          }
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: localFollowUpFailed ? 'reconciliation_required' : 'complete',
          completedSteps: ['provider_write'],
          contentId: freshItem.id,
          observedDataProviderId: freshItem.dataProvider?.id,
        });
        const data = mapProjectRead({
          ...updated,
          visible: project.status === 'published',
        });
        return projectMutationJson(
          { data: { ...data, id: context.reference?.contentId ?? data.id } },
          updated.id
        );
      },
    });
  } catch (error) {
    await finalizeMainserverMutationFailure({ actor, error, contentId });
    return toMainserverErrorResponse(error, 'Projekt konnte nicht aktualisiert werden.');
  }
};

const deleteProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const csrf = requireProjectCsrf(request);
  if (csrf) return csrf;
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const localContext = await loadProjectLocalContext(instanceId, contentId);
  const actorInfo = await projectActorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const authorizedActor = await authorizeProjectOrResponse(
    ctx,
    'projects.delete',
    projectAuthorizationResource(contentId, localContext.core, {
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
      actorAccountId: actorInfo.actorAccountId,
    })
  );
  if (isResponse(authorizedActor)) return authorizedActor;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor });
  if (isResponse(actor)) return actor;
  const context = await loadProjectContext(
    instanceId,
    actor.keycloakSubject,
    contentId,
    actor.activeOrganizationId,
    localContext
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  try {
    return await withProjectMutationLock({
      instanceId,
      lockKey: context.reference?.id ?? context.item.id,
      execute: async () => {
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.item.id,
        });
        if (freshItem.genericType !== PROJECTS_GENERIC_TYPE) {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const providerAuthorization = await authorizeMainserverExistingContent({
          actor,
          action: 'projects.delete',
          contentType: PROJECTS_CONTENT_TYPE,
          contentId,
          item: freshItem,
        });
        if (isResponse(providerAuthorization)) return providerAuthorization;
        await deleteSvaMainserverGenericItem({
          ...actor,
          genericItemId: freshItem.id,
        });
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write', 'tombstone'],
          contentId: freshItem.id,
          observedDataProviderId: freshItem.dataProvider?.id,
        });
        return projectMutationJson(
          { data: { id: context.reference?.contentId ?? freshItem.id } },
          freshItem.id
        );
      },
    });
  } catch (error) {
    await finalizeMainserverMutationFailure({ actor, error, contentId });
    if (context.reference)
      await Promise.resolve(
        updateExternalContentReconciliationStatus({
          instanceId,
          referenceId: context.reference.id,
          status: 'reconciliation_required',
          errorCode: 'provider_delete_failed',
        })
      ).catch(() => undefined);
    return toMainserverErrorResponse(error, 'Projekt konnte nicht gelöscht werden.');
  }
};

const dispatchAuthenticated = async (
  request: Request,
  route: ProjectRoute,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  try {
    if (route.kind === 'collection' && request.method === 'GET')
      return await listProjects(request, ctx);
    if (route.kind === 'item' && request.method === 'GET') {
      return withMainserverContextBinding(await detailProject(request, ctx, route.itemId), ctx);
    }
    if (route.kind === 'collection' && request.method === 'POST')
      return await createProject(request, ctx);
    if (route.kind === 'item' && request.method === 'PATCH')
      return await updateProject(request, ctx, route.itemId);
    if (route.kind === 'item' && request.method === 'DELETE')
      return await deleteProject(request, ctx, route.itemId);
    return errorJson(405, 'method_not_allowed', 'Methode wird für Projekte nicht unterstützt.');
  } catch (error) {
    const logFailure = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    logFailure('Projects route failed', {
      operation: 'mainserver_projects_request',
      request_id: getWorkspaceContext().requestId,
      trace_id: getWorkspaceContext().traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      method: request.method,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Projektanfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverProjectsRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  return route
    ? withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx))
    : null;
};
