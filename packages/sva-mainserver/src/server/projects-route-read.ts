import {
  listExternalContentReferences,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { errorJson, isResponse, json } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  resolveMainserverResourceAccess,
  resolveMainserverResourceActor,
} from './mutation-principal.js';
import { PROJECTS_CONTENT_TYPE } from './projects-contract.js';
import { mapProjectRead } from './projects-create-mapping.js';
import { listAllActiveProjectItems } from './projects-listing.js';
import {
  authorizeProjectOrResponse,
  loadProjectContext,
  loadProjectLocalContext,
  projectActorInfoOrResponse,
  projectAuthorizationResource,
} from './projects-route-authorization.js';
import { projectSourceReferenceInput } from './projects-route-transport.js';
import { listSvaMainserverGenericItems } from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

export const listProjects = async (
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

export const detailProject = async (
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
