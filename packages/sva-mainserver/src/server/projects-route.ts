import { createHash } from 'node:crypto';
import {
  authorizeContentPrimitiveForUser,
  bindExternalContentReference,
  completeIdempotency,
  loadExternalContentCore,
  loadExternalContentReferenceByContentId,
  loadExternalContentReferenceByOperation,
  prepareExternalContent,
  reserveIdempotency,
  resolveActorInfo,
  updateExternalContentCore,
  updateExternalContentReconciliationStatus,
  validateCsrf,
  withAuthenticatedUser,
  withExternalContentMutationLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverGenericItem, SvaMainserverProjectInput } from '../types.js';
import {
  errorJson,
  isResponse,
  json,
  matchRequestRoute,
  type RouteMatch,
} from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  PROJECTS_CONTENT_TYPE,
  PROJECTS_GENERIC_TYPE,
  mapGenericItemToProject,
  mergeProjectIntoGenericItem,
  parseProjectInput,
  validateProjectProjection,
} from './projects-contract.js';
import { listAllActiveProjectItems } from './projects-listing.js';
import {
  changeSvaMainserverGenericItemVisibility,
  createSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
  listSvaMainserverGenericItems,
  updateSvaMainserverGenericItem,
} from './service.js';

const PROJECTS_COLLECTION_PATH = '/api/v1/mainserver/projects';
const SOURCE_SYSTEM = 'mainserver';
const SOURCE_ENTITY_TYPE = 'GenericItem';
const CREATE_ENDPOINT = `POST:${PROJECTS_COLLECTION_PATH}`;
const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

type ProjectRoute = RouteMatch<'projects'>;

type ProjectActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

const matchRoute = (request: Request): ProjectRoute | null =>
  matchRequestRoute(request, PROJECTS_COLLECTION_PATH, 'projects');

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: 'projects.read' | 'projects.create' | 'projects.update' | 'projects.delete',
  resource?: {
    readonly contentId?: string;
    readonly organizationId?: string;
    readonly ownerUserId?: string;
    readonly ownerOrganizationId?: string;
  }
): Promise<ProjectActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: { contentType: PROJECTS_CONTENT_TYPE, ...resource },
  });
  if (!result.ok) return errorJson(result.status, result.error, result.message);
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    ...(result.actor.organizationId ? { activeOrganizationId: result.actor.organizationId } : {}),
  };
};

const requireCsrf = (request: Request): Response | null => {
  const response = validateCsrf(request, getWorkspaceContext().requestId);
  return response
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
};

const idempotencyKeyOrResponse = (request: Request): string | Response => {
  const key = request.headers.get('idempotency-key')?.trim();
  return key
    ? key
    : errorJson(400, 'idempotency_key_required', 'Header Idempotency-Key ist erforderlich.');
};

const projectPayload = (input: SvaMainserverProjectInput, deleted = false) => ({
  language: input.language,
  status: input.status,
  author: input.author,
  deleted,
});

const publishedAtFor = (
  input: SvaMainserverProjectInput,
  current?: string
): string | undefined =>
  input.status === 'published' ? current ?? new Date().toISOString() : current;

const validateAuthorSelection = (input: {
  readonly project: SvaMainserverProjectInput;
  readonly actor: ProjectActor;
  readonly actorAccountId: string;
}): Response | null => {
  if (
    input.project.author.type === 'organization' &&
    input.project.author.id !== input.actor.activeOrganizationId
  ) {
    return errorJson(400, 'invalid_author', 'Die aktive Organisation muss Projekt-Autor sein.');
  }
  if (
    input.project.author.type === 'person' &&
    input.project.author.id !== input.actorAccountId
  ) {
    return errorJson(400, 'invalid_author', 'Die angemeldete Person muss Projekt-Autor sein.');
  }
  return null;
};

const actorInfoOrResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<
  | Readonly<{
      instanceId: string;
      actorAccountId: string;
      requestId?: string;
      traceId?: string;
    }>
  | Response
> => {
  const resolved = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in resolved) return resolved.error;
  return resolved.actor.actorAccountId
    ? { ...resolved.actor, actorAccountId: resolved.actor.actorAccountId }
    : errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
};

const sourceReferenceInput = (instanceId: string) => ({
  instanceId,
  sourceSystem: SOURCE_SYSTEM,
  sourceEntityType: SOURCE_ENTITY_TYPE,
});

const loadProjectContext = async (
  instanceId: string,
  keycloakSubject: string,
  contentId: string,
  activeOrganizationId?: string
) => {
  const reference = await loadExternalContentReferenceByContentId({
    ...sourceReferenceInput(instanceId),
    contentId,
  });
  const genericItemId = reference?.sourceEntityId ?? contentId;
  const item = await getSvaMainserverGenericItem({
    instanceId, keycloakSubject,
    ...(activeOrganizationId ? { activeOrganizationId } : {}), genericItemId,
  }).catch(() => undefined);
  if (!item) return undefined;
  if (item.genericType !== PROJECTS_GENERIC_TYPE) return undefined;
  const payload =
    item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  if (payload.deleted === true) return undefined;
  const core = reference
    ? await loadExternalContentCore(instanceId, reference.contentId).catch(() => undefined)
    : undefined;
  return { core, reference, item };
};

const mapAndValidate = (item: SvaMainserverGenericItem) => {
  const project = mapGenericItemToProject(item);
  const invalid = validateProjectProjection(project);
  if (invalid) {
    throw new SvaMainserverError({
      code: 'invalid_response',
      message: 'Mainserver-Projekt verletzt den FeaturedProject-Vertrag.',
      statusCode: 502,
    });
  }
  return project;
};

const listProjects = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actor = await authorizeOrResponse(ctx, 'projects.read');
  if (isResponse(actor)) return actor;
  const input = { ...actor, ...parseMainserverListQuery(request), includeInvisible: true };
  const upstream = await listAllActiveProjectItems(input, listSvaMainserverGenericItems);
  const projects = upstream.data.map(mapAndValidate);
  projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  const start = (input.page - 1) * input.pageSize;
  const data = projects.slice(start, start + input.pageSize);
  logger.info('Project list upstream pagination completed', {
    operation: 'mainserver_projects_list_upstream',
    upstream_page_count: upstream.observability.upstreamPageCount,
    upstream_item_count: upstream.observability.upstreamItemCount,
    matching_item_count: projects.length,
  });
  return json({
    data,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage: start + input.pageSize < projects.length,
      total: projects.length,
    },
  });
};

const detailProject = async (
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const context = await loadProjectContext(
    instanceId,
    ctx.user.id,
    contentId,
    ctx.activeOrganizationId
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  const actor = await authorizeOrResponse(ctx, 'projects.read');
  if (isResponse(actor)) return actor;
  return json({ data: mapAndValidate(context.item) });
};

const completeCreate = (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly responseBody: unknown;
  readonly responseStatus: number;
  readonly status: 'COMPLETED' | 'FAILED';
}) =>
  completeIdempotency({
    ...input,
    endpoint: CREATE_ENDPOINT,
  });

const findProjectByExternalId = async (
  actor: ProjectActor,
  externalId: string
): Promise<SvaMainserverGenericItem | undefined> => {
  const result = await listAllActiveProjectItems(
    { ...actor, page: 1, pageSize: 100, includeInvisible: true },
    listSvaMainserverGenericItems
  );
  return result.data.find((item) => item.externalId === externalId);
};

const withOptionalProjectMutationLock = async <T>(input: {
  readonly instanceId: string;
  readonly referenceId?: string;
  readonly execute: () => Promise<T>;
}): Promise<T> => input.referenceId
  ? withExternalContentMutationLock({
      instanceId: input.instanceId,
      referenceId: input.referenceId,
      execute: input.execute,
    })
  : input.execute();

const createProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const actor = await authorizeOrResponse(ctx, 'projects.create');
  if (isResponse(actor)) return actor;
  const key = idempotencyKeyOrResponse(request);
  if (isResponse(key)) return key;
  const rawBody = await request.clone().text();
  const project = await parseProjectInput(request);
  if (isResponse(project)) return project;
  const actorInfo = await actorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const authorError = validateAuthorSelection({ project, actor, actorAccountId: actorInfo.actorAccountId });
  if (authorError) return authorError;

  let reference = await loadExternalContentReferenceByOperation({
    ...sourceReferenceInput(actor.instanceId),
    operationExternalId: key,
  }).catch(() => undefined);

  const existing = await findProjectByExternalId(actor, key);
  if (existing) {
    if (reference && !reference.sourceEntityId) {
      try {
        reference = await bindExternalContentReference({
          instanceId: actor.instanceId,
          referenceId: reference.id,
          sourceEntityId: existing.id,
        });
      } catch (error) {
        logger.warn('Project local follow-up failed while repairing provider binding', {
          operation: 'mainserver_projects_local_follow_up',
          instance_id: actor.instanceId,
          error_code: error instanceof Error ? error.name : 'local_finalize_failed',
        });
      }
    }
    const data = mapAndValidate(existing);
    const responseBody = { data };
    await Promise.resolve(completeCreate({
      instanceId: actor.instanceId,
      actorAccountId: actorInfo.actorAccountId,
      idempotencyKey: key,
      responseBody,
      responseStatus: 201,
      status: 'COMPLETED',
    })).catch(() => undefined);
    return json(responseBody, 201);
  }

  try {
    const reserved = await reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actorInfo.actorAccountId,
      endpoint: CREATE_ENDPOINT,
      idempotencyKey: key,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    });
    if (reserved.status === 'replay') return json(reserved.responseBody, reserved.responseStatus);
    if (reserved.status === 'conflict') return errorJson(409, 'idempotency_key_reuse', reserved.message);
  } catch (error) {
    logger.warn('Project local idempotency reservation unavailable; provider externalId remains authoritative', {
      operation: 'mainserver_projects_local_follow_up',
      instance_id: actor.instanceId,
      error_code: error instanceof Error ? error.name : 'local_finalize_failed',
    });
  }

  try {
    const publishedAt = publishedAtFor(project);
    const created = await createSvaMainserverGenericItem({
      ...actor,
      genericItem: mergeProjectIntoGenericItem({ project, externalId: key, publishedAt }),
    });
    await changeSvaMainserverGenericItemVisibility({
      ...actor,
      genericItemId: created.id,
      visible: project.status === 'published',
    });

    try {
      if (!reference) {
        const prepared = await prepareExternalContent({
          ...actorInfo,
          actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
          contentType: PROJECTS_CONTENT_TYPE,
          organizationId: actor.activeOrganizationId,
          authorDisplayMode: project.author.type === 'person' ? 'user' : 'organization',
          title: project.title,
          payload: projectPayload(project),
          status: project.status,
          publishedAt,
          sourceSystem: SOURCE_SYSTEM,
          sourceEntityType: SOURCE_ENTITY_TYPE,
          operationExternalId: key,
        });
        reference = prepared.reference;
      }
      if (!reference.sourceEntityId) {
        reference = await bindExternalContentReference({
          instanceId: actor.instanceId,
          referenceId: reference.id,
          sourceEntityId: created.id,
        });
      }
    } catch (error) {
      logger.warn('Project local follow-up failed after provider create', {
        operation: 'mainserver_projects_local_follow_up',
        instance_id: actor.instanceId,
        error_code: error instanceof Error ? error.name : 'local_finalize_failed',
      });
    }
    const data = mapAndValidate({ ...created, visible: project.status === 'published' });
    const responseBody = { data };
    await Promise.resolve(completeCreate({
      instanceId: actor.instanceId,
      actorAccountId: actorInfo.actorAccountId,
      idempotencyKey: key,
      responseBody,
      responseStatus: 201,
      status: 'COMPLETED',
    })).catch(() => undefined);
    return json(responseBody, 201);
  } catch (error) {
    if (reference) await Promise.resolve(updateExternalContentReconciliationStatus({
      instanceId: actor.instanceId,
      referenceId: reference.id,
      status: 'reconciliation_required',
      errorCode: error instanceof SvaMainserverError ? error.code : 'provider_result_unknown',
    })).catch(() => undefined);
    return toMainserverErrorResponse(error, 'Projekt konnte nicht angelegt werden.');
  }
};

const updateProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const context = await loadProjectContext(
    instanceId,
    ctx.user.id,
    contentId,
    ctx.activeOrganizationId
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  const actor = await authorizeOrResponse(ctx, 'projects.update');
  if (isResponse(actor)) return actor;
  const project = await parseProjectInput(request);
  if (isResponse(project)) return project;
  const actorInfo = await actorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const authorError = validateAuthorSelection({ project, actor, actorAccountId: actorInfo.actorAccountId });
  if (authorError) return authorError;

  try {
    return await withOptionalProjectMutationLock({
      instanceId,
      referenceId: context.reference?.id,
      execute: async () => {
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.item.id,
        });
        if (freshItem.genericType !== PROJECTS_GENERIC_TYPE) {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const publishedAt = publishedAtFor(project, freshItem.publishedAt);
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
        if (context.core && context.reference) try {
          await updateExternalContentCore({
            ...actorInfo,
            actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
            contentId,
            title: project.title,
            payload: projectPayload(project),
            status: project.status,
            publishedAt,
            authorDisplayMode: project.author.type === 'person' ? 'user' : 'organization',
            authorDisplayName: project.author.displayName,
          });
          await updateExternalContentReconciliationStatus({
            instanceId,
            referenceId: context.reference.id,
            status: 'bound',
          });
        } catch (error) {
          await Promise.resolve(updateExternalContentReconciliationStatus({
            instanceId,
            referenceId: context.reference.id,
            status: 'reconciliation_required',
            errorCode: 'local_finalize_failed',
          })).catch(() => undefined);
          logger.warn('Project local follow-up failed after provider update', {
            operation: 'mainserver_projects_local_follow_up',
            instance_id: instanceId,
            error_code: error instanceof Error ? error.name : 'local_finalize_failed',
          });
        }
        return json({ data: mapAndValidate({ ...updated, visible: project.status === 'published' }) });
      },
    });
  } catch (error) {
    return toMainserverErrorResponse(error, 'Projekt konnte nicht aktualisiert werden.');
  }
};

const deleteProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentId: string
): Promise<Response> => {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const instanceId = ctx.user.instanceId;
  if (!instanceId) return errorJson(400, 'missing_instance', 'Instanzkontext fehlt.');
  const context = await loadProjectContext(
    instanceId,
    ctx.user.id,
    contentId,
    ctx.activeOrganizationId
  );
  if (!context) return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
  const actor = await authorizeOrResponse(ctx, 'projects.delete');
  if (isResponse(actor)) return actor;
  const actorInfo = await actorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  try {
    return await withOptionalProjectMutationLock({
      instanceId,
      referenceId: context.reference?.id,
      execute: async () => {
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.item.id,
        });
        if (freshItem.genericType !== PROJECTS_GENERIC_TYPE) {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const freshProject = mapAndValidate(freshItem);
        await updateSvaMainserverGenericItem({
          ...actor,
          genericItemId: freshItem.id,
          genericItem: mergeProjectIntoGenericItem({
            project: freshProject,
            existing: freshItem,
            deleted: true,
            publishedAt: freshItem.publishedAt,
          }),
        });
        await changeSvaMainserverGenericItemVisibility({
          ...actor,
          genericItemId: freshItem.id,
          visible: false,
        });
        if (context.core && context.reference) {
          await Promise.resolve(updateExternalContentCore({
            ...actorInfo,
            actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
            contentId: context.reference.contentId,
            title: freshItem.title,
            payload: { ...projectPayload(freshProject, true) },
            status: freshProject.status,
            publishedAt: freshItem.publishedAt,
            authorDisplayMode: freshProject.author.type === 'person' ? 'user' : 'organization',
            authorDisplayName: freshProject.author.displayName,
          })).catch((error: unknown) => {
            logger.warn('Project local follow-up failed after provider delete', {
              operation: 'mainserver_projects_local_follow_up',
              instance_id: instanceId,
              error_code: error instanceof Error ? error.name : 'local_finalize_failed',
            });
          });
        }
        return json({ data: { id: freshItem.id } });
      },
    });
  } catch (error) {
    if (context.reference) await Promise.resolve(updateExternalContentReconciliationStatus({
      instanceId, referenceId: context.reference.id,
      status: 'reconciliation_required', errorCode: 'soft_delete_finalize_failed',
    })).catch(() => undefined);
    return toMainserverErrorResponse(error, 'Projekt konnte nicht gelöscht werden.');
  }
};

const dispatchAuthenticated = async (
  request: Request,
  route: ProjectRoute,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  try {
    if (route.kind === 'collection' && request.method === 'GET') return await listProjects(request, ctx);
    if (route.kind === 'item' && request.method === 'GET') return await detailProject(ctx, route.itemId);
    if (route.kind === 'collection' && request.method === 'POST') return await createProject(request, ctx);
    if (route.kind === 'item' && request.method === 'PATCH') return await updateProject(request, ctx, route.itemId);
    if (route.kind === 'item' && request.method === 'DELETE') return await deleteProject(request, ctx, route.itemId);
    return errorJson(405, 'method_not_allowed', 'Methode wird für Projekte nicht unterstützt.');
  } catch (error) {
    logger.warn('Projects route failed', {
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
