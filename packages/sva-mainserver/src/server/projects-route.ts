import { createHash } from 'node:crypto';
import {
  authorizeContentPrimitiveForUser,
  bindExternalContentReference,
  completeIdempotency,
  listExternalContentReferences,
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
  type ExternalContentReference,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverGenericItem,
  SvaMainserverProject,
  SvaMainserverProjectInput,
} from '../types.js';
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
  const core = await loadExternalContentCore(instanceId, contentId);
  if (!core || core.contentType !== PROJECTS_CONTENT_TYPE) return undefined;
  const reference = await loadExternalContentReferenceByContentId({
    ...sourceReferenceInput(instanceId),
    contentId,
  });
  if (!reference?.sourceEntityId) return undefined;
  const item = await getSvaMainserverGenericItem({
    instanceId,
    keycloakSubject,
    ...(activeOrganizationId ? { activeOrganizationId } : {}),
    genericItemId: reference.sourceEntityId,
  });
  if (item.genericType !== 'PROJECT') return undefined;
  const payload =
    item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
      ? (item.payload as Record<string, unknown>)
      : {};
  if (payload.deleted === true) return undefined;
  return { core, reference, item };
};

const mapAndValidate = (item: SvaMainserverGenericItem, core: Awaited<ReturnType<typeof loadExternalContentCore>>) => {
  if (!core) throw new Error('external_content_core_not_found');
  const project = mapGenericItemToProject({ item, core });
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
  const [upstream, references] = await Promise.all([
    listAllActiveProjectItems(input, listSvaMainserverGenericItems),
    listExternalContentReferences(sourceReferenceInput(actor.instanceId)),
  ]);
  const itemById = new Map(upstream.data.map((item) => [item.id, item]));
  const joined: SvaMainserverProject[] = [];
  for (const reference of references) {
    if (!reference.sourceEntityId || reference.reconciliationStatus !== 'bound') continue;
    const item = itemById.get(reference.sourceEntityId);
    const core = await loadExternalContentCore(actor.instanceId, reference.contentId);
    if (!item || !core || core.contentType !== PROJECTS_CONTENT_TYPE) continue;
    const project = mapAndValidate(item, core);
    if (!project.deleted) joined.push(project);
  }
  joined.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  const start = (input.page - 1) * input.pageSize;
  const data = joined.slice(start, start + input.pageSize);
  logger.info('Project list upstream pagination completed', {
    operation: 'mainserver_projects_list_upstream',
    upstream_page_count: upstream.observability.upstreamPageCount,
    upstream_item_count: upstream.observability.upstreamItemCount,
    matching_item_count: joined.length,
  });
  return json({
    data,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage: start + input.pageSize < joined.length,
      total: joined.length,
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
  const actor = await authorizeOrResponse(ctx, 'projects.read', {
    contentId,
    organizationId: context.core.organizationId,
    ownerUserId: context.core.ownerUserId,
    ownerOrganizationId: context.core.ownerOrganizationId,
  });
  if (isResponse(actor)) return actor;
  return json({ data: mapAndValidate(context.item, context.core) });
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
  });
  let core = reference
    ? await loadExternalContentCore(actor.instanceId, reference.contentId)
    : undefined;

  if (reference) {
    const repaired = await findProjectByExternalId(actor, key);
    if (repaired) {
      if (!reference.sourceEntityId) {
        reference = await bindExternalContentReference({
          instanceId: actor.instanceId,
          referenceId: reference.id,
          sourceEntityId: repaired.id,
        });
      }
      const data = mapAndValidate(repaired, core);
      const responseBody = { data };
      await completeCreate({
        instanceId: actor.instanceId,
        actorAccountId: actorInfo.actorAccountId,
        idempotencyKey: key,
        responseBody,
        responseStatus: 201,
        status: 'COMPLETED',
      });
      return json(responseBody, 201);
    }
  } else {
    const reserved = await reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actorInfo.actorAccountId,
      endpoint: CREATE_ENDPOINT,
      idempotencyKey: key,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    });
    if (reserved.status === 'replay') return json(reserved.responseBody, reserved.responseStatus);
    if (reserved.status === 'conflict') return errorJson(409, 'idempotency_key_reuse', reserved.message);
    try {
      const prepared = await prepareExternalContent({
        ...actorInfo,
        actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
        contentType: PROJECTS_CONTENT_TYPE,
        organizationId: actor.activeOrganizationId,
        authorDisplayMode: project.author.type === 'person' ? 'user' : 'organization',
        title: project.title,
        payload: projectPayload(project),
        status: project.status,
        publishedAt: publishedAtFor(project),
        sourceSystem: SOURCE_SYSTEM,
        sourceEntityType: SOURCE_ENTITY_TYPE,
        operationExternalId: key,
      });
      reference = prepared.reference;
      core = await loadExternalContentCore(actor.instanceId, prepared.contentId);
    } catch {
      const responseBody = { error: 'database_unavailable', message: 'Projekt konnte nicht vorbereitet werden.' };
      await completeCreate({
        instanceId: actor.instanceId,
        actorAccountId: actorInfo.actorAccountId,
        idempotencyKey: key,
        responseBody,
        responseStatus: 503,
        status: 'FAILED',
      });
      return json(responseBody, 503);
    }
  }

  if (!reference || !core) return errorJson(503, 'database_unavailable', 'Projekt konnte nicht vorbereitet werden.');

  try {
    const publishedAt = publishedAtFor(project, core.publishedAt);
    const created = await createSvaMainserverGenericItem({
      ...actor,
      genericItem: mergeProjectIntoGenericItem({ project, externalId: key, publishedAt }),
    });
    await changeSvaMainserverGenericItemVisibility({
      ...actor,
      genericItemId: created.id,
      visible: project.status === 'published',
    });
    await bindExternalContentReference({
      instanceId: actor.instanceId,
      referenceId: reference.id,
      sourceEntityId: created.id,
    });
    const data = mapAndValidate(
      { ...created, visible: project.status === 'published' },
      core
    );
    const responseBody = { data };
    await completeCreate({
      instanceId: actor.instanceId,
      actorAccountId: actorInfo.actorAccountId,
      idempotencyKey: key,
      responseBody,
      responseStatus: 201,
      status: 'COMPLETED',
    });
    return json(responseBody, 201);
  } catch (error) {
    await updateExternalContentReconciliationStatus({
      instanceId: actor.instanceId,
      referenceId: reference.id,
      status: 'reconciliation_required',
      errorCode: error instanceof SvaMainserverError ? error.code : 'provider_result_unknown',
    });
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
  const actor = await authorizeOrResponse(ctx, 'projects.update', {
    contentId,
    organizationId: context.core.organizationId,
    ownerUserId: context.core.ownerUserId,
    ownerOrganizationId: context.core.ownerOrganizationId,
  });
  if (isResponse(actor)) return actor;
  const project = await parseProjectInput(request);
  if (isResponse(project)) return project;
  const actorInfo = await actorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const authorError = validateAuthorSelection({ project, actor, actorAccountId: actorInfo.actorAccountId });
  if (authorError) return authorError;

  try {
    return await withExternalContentMutationLock({
      instanceId,
      referenceId: context.reference.id,
      execute: async () => {
        const freshCore = await loadExternalContentCore(instanceId, contentId);
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
        });
        if (!freshCore || freshItem.genericType !== 'PROJECT') {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const publishedAt = publishedAtFor(project, freshCore.publishedAt);
        const updated = await updateSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
          genericItem: mergeProjectIntoGenericItem({
            project,
            existing: freshItem,
            publishedAt,
          }),
        });
        await changeSvaMainserverGenericItemVisibility({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
          visible: project.status === 'published',
        });
        try {
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
          await updateExternalContentReconciliationStatus({
            instanceId,
            referenceId: context.reference.id,
            status: 'reconciliation_required',
            errorCode: 'local_finalize_failed',
          });
          throw error;
        }
        const nextCore = await loadExternalContentCore(instanceId, contentId);
        return json({ data: mapAndValidate({ ...updated, visible: project.status === 'published' }, nextCore) });
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
  const actor = await authorizeOrResponse(ctx, 'projects.delete', {
    contentId,
    organizationId: context.core.organizationId,
    ownerUserId: context.core.ownerUserId,
    ownerOrganizationId: context.core.ownerOrganizationId,
  });
  if (isResponse(actor)) return actor;
  const actorInfo = await actorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  try {
    return await withExternalContentMutationLock({
      instanceId,
      referenceId: context.reference.id,
      execute: async () => {
        const freshCore = await loadExternalContentCore(instanceId, contentId);
        const freshItem = await getSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
        });
        if (!freshCore || freshItem.genericType !== 'PROJECT') {
          return errorJson(404, 'not_found', 'Projekt wurde nicht gefunden.');
        }
        const freshProject = mapAndValidate(freshItem, freshCore);
        await updateSvaMainserverGenericItem({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
          genericItem: mergeProjectIntoGenericItem({
            project: freshProject,
            existing: freshItem,
            deleted: true,
            publishedAt: freshCore.publishedAt,
          }),
        });
        await changeSvaMainserverGenericItemVisibility({
          ...actor,
          genericItemId: context.reference.sourceEntityId!,
          visible: false,
        });
        await updateExternalContentCore({
          ...actorInfo,
          actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
          contentId,
          title: freshCore.title,
          payload: { ...projectPayload(freshProject, true) },
          status: freshCore.status,
          publishedAt: freshCore.publishedAt,
          authorDisplayMode: freshCore.authorDisplayMode,
          authorDisplayName: freshCore.author,
        });
        return json({ data: { id: contentId } });
      },
    });
  } catch (error) {
    await updateExternalContentReconciliationStatus({
      instanceId,
      referenceId: context.reference.id,
      status: 'reconciliation_required',
      errorCode: 'soft_delete_finalize_failed',
    });
    return toMainserverErrorResponse(error, 'Projekt konnte nicht gelöscht werden.');
  }
};

const dispatchAuthenticated = async (
  request: Request,
  route: ProjectRoute,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  try {
    if (route.kind === 'collection' && request.method === 'GET') return listProjects(request, ctx);
    if (route.kind === 'item' && request.method === 'GET') return detailProject(ctx, route.itemId);
    if (route.kind === 'collection' && request.method === 'POST') return createProject(request, ctx);
    if (route.kind === 'item' && request.method === 'PATCH') return updateProject(request, ctx, route.itemId);
    if (route.kind === 'item' && request.method === 'DELETE') return deleteProject(request, ctx, route.itemId);
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
