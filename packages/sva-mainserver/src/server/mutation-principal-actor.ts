import {
  recordMainserverDataProviderObservation,
  resolveActorInfo,
  resolveMutationPrincipalContext,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverConnectionInput } from '../types.js';
import {
  createMainserverContextBinding,
  MAINSERVER_CONTEXT_BINDING_HEADER,
  readActingPrincipalType,
  readMainserverOperationId,
} from './content-route-context.js';
import { errorJson, isResponse } from './content-route-core.js';
import type {
  MainserverMutationActor,
  MainserverMutationFollowUpContext,
} from './mutation-principal-types.js';
import { loadSvaMainserverDataProviderIdentity } from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-mutation-principal', level: 'info' });
const mutationFollowUpContexts = new WeakMap<Request, MainserverMutationFollowUpContext>();

export const readMainserverMutationFollowUpContext = (
  request: Request
): MainserverMutationFollowUpContext | undefined => mutationFollowUpContexts.get(request);

const principalResolutionError = (status: string): Response => {
  switch (status) {
    case 'acting_principal_not_allowed':
      return errorJson(403, status, 'Der ausgewählte Mutationsprincipal ist nicht zulässig.');
    case 'organization_mainserver_credentials_missing':
      return errorJson(409, status, 'Für die aktive Organisation fehlen Mainserver-Credentials.');
    case 'missing_credentials':
      return errorJson(400, status, 'Für den Benutzer fehlen Mainserver-Credentials.');
    case 'database_unavailable':
    case 'identity_provider_unavailable':
      return errorJson(
        503,
        status,
        'Der Mainserver-Credential-Kontext konnte nicht geladen werden.'
      );
    default:
      return errorJson(
        403,
        'acting_principal_not_allowed',
        'Der ausgewählte Mutationsprincipal ist nicht zulässig.'
      );
  }
};

const hasCurrentContextBinding = (
  request: Request,
  authorizedActor: SvaMainserverConnectionInput
): boolean => {
  const supplied = request.headers.get(MAINSERVER_CONTEXT_BINDING_HEADER)?.trim();
  return (
    !supplied ||
    supplied ===
      createMainserverContextBinding({
        user: { id: authorizedActor.keycloakSubject, instanceId: authorizedActor.instanceId },
        activeOrganizationId: authorizedActor.activeOrganizationId,
      })
  );
};

const observeStableDataProviderIdentity = async (actor: MainserverMutationActor): Promise<void> => {
  try {
    const identity = await loadSvaMainserverDataProviderIdentity(actor);
    const dataProviderId = identity.dataProvider.id?.trim();
    if (!identity.hasStableId || !dataProviderId) return;
    await recordMainserverDataProviderObservation({
      instanceId: actor.instanceId,
      principalType: actor.mutationPrincipalContext.actingPrincipalType,
      principalId: actor.mutationPrincipalContext.actingPrincipalId,
      credentialFingerprint: actor.mutationPrincipalContext.credentialFingerprint,
      dataProviderId,
      dataProviderName: identity.dataProvider.name,
      evidenceKind: 'identity_endpoint',
    });
  } catch (error) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver DataProvider identity observation failed', {
      operation: 'mainserver_data_provider_identity_observation',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      instance_id: actor.instanceId,
      error_code: error instanceof Error ? error.name : 'unknown_error',
    });
  }
};

export const resolveMainserverMutationActor = async (input: {
  readonly request: Request;
  readonly ctx: AuthenticatedRequestContext;
  readonly authorizedActor: SvaMainserverConnectionInput;
}): Promise<MainserverMutationActor | Response> => {
  const actingPrincipalType = readActingPrincipalType(input.request);
  if (isResponse(actingPrincipalType)) return actingPrincipalType;

  const actorInfo = await resolveActorInfo(input.request, input.ctx, {
    requireActorMembership: true,
  });
  if ('error' in actorInfo) return actorInfo.error;
  const actorAccountId = actorInfo.actor.actorAccountId;
  if (!actorAccountId) {
    return errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
  }
  if (!hasCurrentContextBinding(input.request, input.authorizedActor)) {
    return errorJson(
      409,
      'stale_mainserver_context',
      'Der Organisationskontext des Editors ist nicht mehr aktuell.'
    );
  }

  const resolved = await resolveMutationPrincipalContext({
    instanceId: input.authorizedActor.instanceId,
    actorAccountId,
    keycloakSubject: input.authorizedActor.keycloakSubject,
    activeOrganizationId: input.authorizedActor.activeOrganizationId,
    actingPrincipalType,
  });
  if (!resolved.ok) return principalResolutionError(resolved.status);

  const actor: MainserverMutationActor = {
    instanceId: resolved.context.instanceId,
    keycloakSubject: resolved.context.keycloakSubject,
    ...(resolved.context.activeOrganizationId
      ? { activeOrganizationId: resolved.context.activeOrganizationId }
      : {}),
    actingPrincipalType: resolved.context.actingPrincipalType,
    credentialFingerprint: resolved.context.credentialFingerprint,
    actorAccountId,
    operationExternalId: readMainserverOperationId(input.request),
    mutationPrincipalContext: resolved.context,
  };
  mutationFollowUpContexts.set(input.request, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
    actorAccountId: actor.actorAccountId,
    actorDisplayName: input.ctx.user.displayName ?? input.ctx.user.username ?? input.ctx.user.id,
    ...(actor.activeOrganizationId ? { activeOrganizationId: actor.activeOrganizationId } : {}),
    actingPrincipalType: actor.mutationPrincipalContext.actingPrincipalType,
    credentialSource: actor.mutationPrincipalContext.credentialSource,
    credentialFingerprint: actor.mutationPrincipalContext.credentialFingerprint,
    operationExternalId: actor.operationExternalId,
  });
  await observeStableDataProviderIdentity(actor);
  return actor;
};
