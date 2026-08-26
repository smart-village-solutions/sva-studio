import {
  loadCurrentMainserverDataProviderBinding,
  reconcileDeletedUserDataProviderConflict,
  recordMainserverDataProviderObservation,
  resolveActorInfo,
  resolveMutationPrincipalContext,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverConnectionInput } from '../types.js';
import {
  MAINSERVER_ACTING_PRINCIPAL_HEADER,
  createMainserverContextBinding,
  MAINSERVER_CONTRACT_VERSION,
  MAINSERVER_CONTRACT_VERSION_HEADER,
  MAINSERVER_CONTEXT_BINDING_HEADER,
  readActingPrincipalType,
  readMainserverOperationId,
} from './content-route-context.js';
import { errorJson, isResponse } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
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
  const requiresBinding =
    request.method !== 'POST' &&
    request.headers.get(MAINSERVER_CONTRACT_VERSION_HEADER)?.trim() === MAINSERVER_CONTRACT_VERSION;
  return (
    (!supplied && !requiresBinding) ||
    supplied ===
      createMainserverContextBinding({
        user: { id: authorizedActor.keycloakSubject, instanceId: authorizedActor.instanceId },
        activeOrganizationId: authorizedActor.activeOrganizationId,
      })
  );
};

export const ensureStableDataProviderIdentity = async (
  actor: MainserverMutationActor,
  options: Readonly<{ reconcileConflicts?: boolean }> = {}
): Promise<Response | null> => {
  try {
    const existingBinding = await loadCurrentMainserverDataProviderBinding({
      instanceId: actor.instanceId,
      principalType: actor.mutationPrincipalContext.actingPrincipalType,
      principalId: actor.mutationPrincipalContext.actingPrincipalId,
      credentialFingerprint: actor.mutationPrincipalContext.credentialFingerprint,
    });
    if (existingBinding) return null;

    const identity = await loadSvaMainserverDataProviderIdentity(actor);
    const observation = await recordMainserverDataProviderObservation({
      instanceId: actor.instanceId,
      principalType: actor.mutationPrincipalContext.actingPrincipalType,
      principalId: actor.mutationPrincipalContext.actingPrincipalId,
      credentialFingerprint: actor.mutationPrincipalContext.credentialFingerprint,
      dataProviderId: identity.dataProvider.id,
      dataProviderName: identity.dataProvider.name,
      evidenceKind: 'identity_endpoint',
    });
    if (observation.outcome === 'conflict') {
      if (options.reconcileConflicts !== true) {
        return errorJson(
          409,
          'mainserver_data_provider_identity_conflict',
          'Die Mainserver-Credentials sind keinem eindeutigen DataProvider zugeordnet.'
        );
      }
      const reconciliation = await reconcileDeletedUserDataProviderConflict({
        instanceId: actor.instanceId,
        principalType: actor.mutationPrincipalContext.actingPrincipalType,
        principalId: actor.mutationPrincipalContext.actingPrincipalId,
        credentialFingerprint: actor.mutationPrincipalContext.credentialFingerprint,
        dataProviderId: identity.dataProvider.id,
      });
      const workspaceContext = getWorkspaceContext();
      const reconciliationContext = {
        operation: 'mainserver_data_provider_identity_conflict_reconciliation',
        request_id: workspaceContext.requestId,
        trace_id: workspaceContext.traceId,
        instance_id: actor.instanceId,
        principal_type: actor.mutationPrincipalContext.actingPrincipalType,
        credential_fingerprint: actor.mutationPrincipalContext.credentialFingerprint,
        data_provider_id: identity.dataProvider.id,
      };
      if (reconciliation.outcome === 'resolved') {
        logger.info('Mainserver DataProvider identity conflict reconciled', {
          ...reconciliationContext,
          result: 'resolved',
          reason_code: 'permanently_deleted_competitors_historized',
          historical_binding_count: reconciliation.historicalBindingCount,
        });
        return null;
      }
      logger.warn('Mainserver DataProvider identity conflict remained fail-closed', {
        ...reconciliationContext,
        result: 'not_resolved',
        reason_code: reconciliation.reason,
        historical_binding_count: 0,
      });
      return errorJson(
        409,
        'mainserver_data_provider_identity_conflict',
        'Die Mainserver-Credentials sind keinem eindeutigen DataProvider zugeordnet.'
      );
    }
    return null;
  } catch (error) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver DataProvider identity verification failed', {
      operation: 'mainserver_data_provider_identity_verification',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      instance_id: actor.instanceId,
      error_code: error instanceof SvaMainserverError ? error.code : 'database_unavailable',
    });
    return error instanceof SvaMainserverError
      ? errorJson(error.statusCode, error.code, error.message)
      : errorJson(
          503,
          'database_unavailable',
          'Die DataProvider-Identität konnte nicht verifiziert werden.'
        );
  }
};

export const resolveMainserverMutationActor = async (input: {
  readonly request: Request;
  readonly ctx: AuthenticatedRequestContext;
  readonly authorizedActor: SvaMainserverConnectionInput;
}): Promise<MainserverMutationActor | Response> => {
  const actingPrincipalType = readActingPrincipalType(input.request);
  if (isResponse(actingPrincipalType)) return actingPrincipalType;

  const actor = await resolveMainserverActor({
    ...input,
    actingPrincipalType,
    requireCurrentContextBinding: true,
  });
  if (isResponse(actor)) return actor;
  const identityError = await ensureStableDataProviderIdentity(actor, { reconcileConflicts: true });
  if (identityError) return identityError;

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
  return actor;
};

const resolveMainserverActor = async (input: {
  readonly request: Request;
  readonly ctx: AuthenticatedRequestContext;
  readonly authorizedActor: SvaMainserverConnectionInput;
  readonly actingPrincipalType?: 'organization' | 'user';
  readonly requireCurrentContextBinding?: boolean;
}): Promise<MainserverMutationActor | Response> => {
  const actorInfo = await resolveActorInfo(input.request, input.ctx, {
    requireActorMembership: true,
  });
  if ('error' in actorInfo) return actorInfo.error;
  const actorAccountId = actorInfo.actor.actorAccountId;
  if (!actorAccountId) {
    return errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
  }
  if (
    input.requireCurrentContextBinding === true &&
    !hasCurrentContextBinding(input.request, input.authorizedActor)
  ) {
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
    actingPrincipalType: input.actingPrincipalType,
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
  return actor;
};

export const resolveMainserverResourceActor = async (input: {
  readonly request: Request;
  readonly ctx: AuthenticatedRequestContext;
  readonly authorizedActor: SvaMainserverConnectionInput;
}): Promise<MainserverMutationActor | undefined> => {
  if (!input.request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER)) return undefined;
  const actingPrincipalType = readActingPrincipalType(input.request);
  if (isResponse(actingPrincipalType)) return undefined;
  const actor = await resolveMainserverActor({ ...input, actingPrincipalType });
  if (isResponse(actor)) return undefined;
  return (await ensureStableDataProviderIdentity(actor)) ? undefined : actor;
};
