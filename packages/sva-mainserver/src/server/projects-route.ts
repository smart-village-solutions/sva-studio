import {
  updateExternalContentCore,
  updateExternalContentReconciliationStatus,
  withAuthenticatedUser,
  withExternalContentMutationLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson, isResponse, parseDetachLinkedContent } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  resolveMainserverLifecycleAction,
  resolveMainserverMutationActor,
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
import {
  authorizeProjectOrResponse,
  loadProjectContext,
  loadProjectLocalContext,
  projectActorInfoOrResponse,
  projectAuthorizationResource,
  requireProjectCsrf,
} from './projects-route-authorization.js';
import { detailProject, listProjects } from './projects-route-read.js';
import {
  matchProjectRoute,
  projectMutationJson,
  type ProjectRoute,
} from './projects-route-transport.js';
import {
  changeSvaMainserverGenericItemVisibility,
  deleteSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
  updateSvaMainserverGenericItem,
} from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

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
    return await withExternalContentMutationLock({
      instanceId,
      referenceId: context.reference?.id ?? context.item.id,
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
        let localFollowUpFailed = Boolean(context.reference && !context.core);
        let projectCoreUpdated = false;
        if (localFollowUpFailed && context.reference)
          await Promise.resolve(
            updateExternalContentReconciliationStatus({
              instanceId,
              referenceId: context.reference.id,
              status: 'reconciliation_required',
              errorCode: 'local_finalize_failed',
            })
          ).catch(() => undefined);
        if (context.core && context.reference)
          try {
            await updateExternalContentCore({
              ...actorInfo,
              actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
              contentId: context.reference.contentId,
              title: project.title,
              payload: projectPayload(project),
              status: project.status,
              publishedAt,
              authorDisplayMode: actor.mutationPrincipalContext.actingPrincipalType,
              authorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
            });
            projectCoreUpdated = true;
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
          completedSteps: [
            'provider_write',
            ...(projectCoreUpdated ? ['project_core_updated'] : []),
          ],
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
  const detachLinkedContent = parseDetachLinkedContent(request);
  if (isResponse(detachLinkedContent)) return detachLinkedContent;
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
    return await withExternalContentMutationLock({
      instanceId,
      referenceId: context.reference?.id ?? context.item.id,
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
          detachLinkedContent,
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
  const route = matchProjectRoute(request);
  return route
    ? withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx))
    : null;
};
