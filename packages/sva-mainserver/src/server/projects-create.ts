import { createHash } from 'node:crypto';
import {
  bindExternalContentReference,
  loadExternalContentReferenceByOperation,
  prepareExternalContent,
  updateExternalContentReconciliationStatus,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import type { SvaMainserverGenericItem } from '../types.js';
import { errorJson, isResponse } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverCreateForPrincipal,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  recordCreatedMainserverDataProvider,
  resolveMainserverMutationActor,
} from './mutation-principal.js';
import {
  PROJECTS_CONTENT_TYPE,
  mergeProjectIntoGenericItem,
  parseProjectInput,
} from './projects-contract.js';
import {
  mapProjectRead,
  projectCreateResponseBody,
  projectPayload,
  publishedAtForProject,
} from './projects-create-mapping.js';
import {
  completeExistingProjectCreate,
  completeSuccessfulProjectCreate,
  deletedProjectReplayResponse,
  findExistingProjectCreate,
  reserveOrRecoverProjectCreate,
} from './projects-create-idempotency.js';
import type { ProjectCreateContext, ProjectCreateState } from './projects-create-types.js';
import {
  authorizeProjectOrResponse,
  projectActorInfoOrResponse,
  requireProjectCsrf,
} from './projects-route-authorization.js';
import { projectSourceReferenceInput } from './projects-route-transport.js';
import {
  changeSvaMainserverGenericItemVisibility,
  createSvaMainserverGenericItem,
  getSvaMainserverGenericItem,
} from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-projects-route', level: 'info' });

const idempotencyKeyOrResponse = (request: Request): string | Response => {
  const key = request.headers.get('idempotency-key')?.trim();
  return key
    ? key
    : errorJson(400, 'idempotency_key_required', 'Header Idempotency-Key ist erforderlich.');
};

const prepareProjectCreate = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<ProjectCreateContext | Response> => {
  const csrf = requireProjectCsrf(request);
  if (csrf) return csrf;
  const authorizedActor = await authorizeProjectOrResponse(ctx, 'projects.create');
  if (isResponse(authorizedActor)) return authorizedActor;
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor });
  if (isResponse(actor)) return actor;
  const idempotencyKey = idempotencyKeyOrResponse(request);
  if (isResponse(idempotencyKey)) return idempotencyKey;
  const rawBody = await request.clone().text();
  const project = await parseProjectInput(request);
  if (isResponse(project)) return project;
  const actorInfo = await projectActorInfoOrResponse(request, ctx);
  if (isResponse(actorInfo)) return actorInfo;
  const principalAuthorization = await authorizeMainserverCreateForPrincipal({
    actor,
    action: 'projects.create',
    contentType: PROJECTS_CONTENT_TYPE,
  });
  if (isResponse(principalAuthorization)) return principalAuthorization;
  return {
    actor,
    actorInfo,
    idempotencyKey,
    payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    project,
  };
};

const finalizeProjectCreateReference = async (
  context: ProjectCreateContext,
  state: ProjectCreateState,
  ctx: AuthenticatedRequestContext,
  created: SvaMainserverGenericItem,
  publishedAt?: string
): Promise<boolean> => {
  try {
    if (!state.reference) {
      const prepared = await prepareExternalContent({
        ...context.actorInfo,
        actorDisplayName: ctx.user.displayName ?? ctx.user.username ?? ctx.user.id,
        contentType: PROJECTS_CONTENT_TYPE,
        organizationId:
          context.actor.mutationPrincipalContext.actingPrincipalType === 'organization'
            ? context.actor.activeOrganizationId
            : undefined,
        authorDisplayMode: context.actor.mutationPrincipalContext.actingPrincipalType,
        title: context.project.title,
        payload: projectPayload(context.project),
        status: context.project.status,
        publishedAt,
        ...projectSourceReferenceInput(context.actor.instanceId),
        operationExternalId: context.idempotencyKey,
      });
      state.reference = prepared.reference;
    }
    if (!state.reference.sourceEntityId) {
      state.reference = await bindExternalContentReference({
        instanceId: context.actor.instanceId,
        referenceId: state.reference.id,
        sourceEntityId: created.id,
      });
    }
    return false;
  } catch (error) {
    logger.warn('Project local follow-up failed after provider create', {
      operation: 'mainserver_projects_local_follow_up',
      instance_id: context.actor.instanceId,
      error_code: error instanceof Error ? error.name : 'local_finalize_failed',
    });
    return true;
  }
};

const createNewProviderProject = async (
  context: ProjectCreateContext,
  state: ProjectCreateState,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const publishedAt = publishedAtForProject(context.project);
  const created = await createSvaMainserverGenericItem({
    ...context.actor,
    genericItem: mergeProjectIntoGenericItem({
      project: context.project,
      externalId: context.idempotencyKey,
      publishedAt,
    }),
  });
  const bindingResult = await recordCreatedMainserverDataProvider({
    actor: context.actor,
    created,
    reread: async () =>
      await getSvaMainserverGenericItem({ ...context.actor, genericItemId: created.id }),
    contentType: PROJECTS_CONTENT_TYPE,
  });
  await changeSvaMainserverGenericItemVisibility({
    ...context.actor,
    genericItemId: created.id,
    visible: context.project.status === 'published',
  });
  const localFollowUpFailed = await finalizeProjectCreateReference(
    context,
    state,
    ctx,
    created,
    publishedAt
  );
  const bindingReconciliationRequired =
    bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required';
  const reconciliationRequired = localFollowUpFailed || bindingReconciliationRequired;
  const responseBody = projectCreateResponseBody({
    project: mapProjectRead({
      ...created,
      visible: context.project.status === 'published',
    }),
    ...(state.reference?.sourceEntityId ? { localContentId: state.reference.contentId } : {}),
    reconciliationRequired: bindingReconciliationRequired,
  });
  await finalizeMainserverMutation({
    actor: context.actor,
    providerOutcome: 'succeeded',
    reconciliationStatus: reconciliationRequired ? 'reconciliation_required' : 'complete',
    completedSteps: ['provider_write', 'binding_observation'],
    contentId: created.id,
    observedDataProviderId: created.dataProvider?.id ?? bindingResult.observedDataProviderId,
  });
  return await completeSuccessfulProjectCreate(context, responseBody, created.id);
};

export const createProject = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const context = await prepareProjectCreate(request, ctx);
  if (isResponse(context)) return context;
  const state: ProjectCreateState = {};
  try {
    state.reference = await loadExternalContentReferenceByOperation({
      ...projectSourceReferenceInput(context.actor.instanceId),
      operationExternalId: context.idempotencyKey,
    }).catch(() => undefined);
    const existing = await findExistingProjectCreate(context, state.reference);
    if (existing) return await completeExistingProjectCreate(context, state, existing);
    if (state.reference?.sourceEntityId) return await deletedProjectReplayResponse(context);
    if (!state.reference) {
      const reserved = await reserveOrRecoverProjectCreate(context);
      if (isResponse(reserved)) return reserved;
      if (reserved) return await completeExistingProjectCreate(context, state, reserved);
    }
    return await createNewProviderProject(context, state, ctx);
  } catch (error) {
    await finalizeMainserverMutationFailure({ actor: context.actor, error });
    if (state.reference)
      await Promise.resolve(
        updateExternalContentReconciliationStatus({
          instanceId: context.actor.instanceId,
          referenceId: state.reference.id,
          status: 'reconciliation_required',
          errorCode: error instanceof SvaMainserverError ? error.code : 'provider_result_unknown',
        })
      ).catch(() => undefined);
    return toMainserverErrorResponse(error, 'Projekt konnte nicht angelegt werden.');
  }
};
