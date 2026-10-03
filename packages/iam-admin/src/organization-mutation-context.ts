import { hasSystemAdminRole } from '@sva/core';
import { updateOrganizationContextSchema } from './organization-schemas.js';
import type {
  OrganizationMutationAuthenticatedRequestContext,
  OrganizationMutationHandlerDeps,
} from './organization-mutation-handlers.js';

const prepareContext = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: OrganizationMutationAuthenticatedRequestContext
) => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(
    deps.getFeatureFlags(),
    'iam_ui',
    requestContext.requestId
  );
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return deps.createApiError(
      403,
      'forbidden',
      'Akteur-Account nicht gefunden.',
      actorResolution.actor.requestId
    );
  }
  const actor = {
    ...actorResolution.actor,
    actorAccountId: actorResolution.actor.actorAccountId,
  };

  const csrfError = deps.validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await deps.parseRequestBody(request, updateOrganizationContextSchema);
  if (!parsed.ok) {
    return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
  }
  return { actor, parsed };
};

const executeContext = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  ctx: OrganizationMutationAuthenticatedRequestContext,
  prepared: Exclude<Awaited<ReturnType<typeof prepareContext>>, Response>
): Promise<Response> => {
  const { actor, parsed } = prepared;
  try {
    const organizations = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      deps.loadContextOptions(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
      })
    );
    if (hasSystemAdminRole(ctx.user.roles)) {
      await deps.updateSession(ctx.sessionId, { activeOrganizationId: undefined });

      return deps.jsonResponse(
        200,
        deps.asApiItem(
          {
            activeOrganizationId: undefined,
            organizations,
          },
          actor.requestId
        )
      );
    }
    const target = organizations.find(
      (organization) => organization.organizationId === parsed.data.organizationId
    );
    if (!target) {
      return deps.createApiError(
        400,
        'invalid_organization_id',
        'Organisation gehört nicht zum Benutzerkontext.',
        actor.requestId
      );
    }
    if (!target.isActive) {
      return deps.createApiError(
        409,
        'organization_inactive',
        'Inaktive Organisation kann kein aktiver Kontext sein.',
        actor.requestId
      );
    }

    await deps.updateSession(ctx.sessionId, { activeOrganizationId: target.organizationId });
    await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
      await deps.notifyPermissionInvalidation(client, {
        instanceId: actor.instanceId,
        keycloakSubject: ctx.user.id,
        trigger: 'organization_context_switched',
      });
      await deps.emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        subjectId: actor.actorAccountId,
        eventType: 'organization.context_switched',
        result: 'success',
        payload: {
          organizationId: target.organizationId,
          organizationKey: target.organizationKey,
        },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    const response = {
      activeOrganizationId: target.organizationId,
      organizations,
    };

    deps.logger.info('Organization context switched', {
      workspace_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      context: {
        operation: 'organization_context_switched',
        organization_id: target.organizationId,
      },
    });

    return deps.jsonResponse(200, deps.asApiItem(response, actor.requestId));
  } catch {
    return deps.createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actor.requestId
    );
  }
};

export const createOrganizationContextHandler = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const updateMyOrganizationContextInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareContext(deps, request, ctx);
    return prepared instanceof Response ? prepared : executeContext(deps, ctx, prepared);
  };
  return { updateMyOrganizationContextInternal };
};
