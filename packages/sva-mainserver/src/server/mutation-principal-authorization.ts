import {
  authorizeMainserverCreatePrincipal,
  authorizeMainserverDataProviderAccess,
  beginMainserverMutationJournal,
  emitAuthAuditEvent,
  resolveEffectivePermissions,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { errorJson } from './content-route-core.js';
import type {
  DataProviderBearingItem,
  MainserverMutationActor,
  MainserverMutationAuthorization,
} from './mutation-principal-types.js';

const logger = createSdkLogger({ component: 'sva-mainserver-mutation-principal', level: 'info' });

const loadMutationPermissions = async (actor: MainserverMutationActor) =>
  resolveEffectivePermissions({
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
    ...(actor.activeOrganizationId ? { organizationId: actor.activeOrganizationId } : {}),
  });

type AuthorizationAuditInput = Readonly<{
  actor: MainserverMutationActor;
  action: string;
  contentType: string;
  contentId?: string;
  dataProviderId?: string;
  authorizationMode: MainserverMutationAuthorization['authorizationMode'];
  resolverMode?: MainserverMutationAuthorization['resolverMode'];
  candidateAuthorizationMode?: MainserverMutationAuthorization['candidateAuthorizationMode'];
  candidateAllowed?: boolean;
  shadowDifference?: boolean;
  allowed: boolean;
  reasonCode?: string;
}>;

const emitMainserverMutationAuthorizationAudit = async (
  input: AuthorizationAuditInput
): Promise<void> => {
  const actionNamespace = input.action.split('.')[0] ?? 'content';
  const workspaceContext = getWorkspaceContext();
  try {
    await emitAuthAuditEvent({
      eventType: input.allowed ? 'plugin_action_authorized' : 'plugin_action_denied',
      actorUserId: input.actor.keycloakSubject,
      scope: { kind: 'instance', instanceId: input.actor.instanceId },
      workspaceId: input.actor.instanceId,
      outcome: input.allowed ? 'success' : 'denied',
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
      pluginAction: {
        actionId: input.action,
        actionNamespace,
        actionOwner: 'sva-mainserver',
        result: input.allowed ? 'success' : 'denied',
        reasonCode: input.reasonCode,
        resourceType: input.contentType,
        resourceId: input.contentId,
        mainserverMutation: {
          actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
          actingPrincipalId: input.actor.mutationPrincipalContext.actingPrincipalId,
          activeOrganizationId: input.actor.activeOrganizationId,
          credentialSource: input.actor.mutationPrincipalContext.credentialSource,
          credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
          dataProviderId: input.dataProviderId,
          authorizationMode: input.authorizationMode,
          resolverMode: input.resolverMode,
          candidateAuthorizationMode: input.candidateAuthorizationMode,
          candidateAllowed: input.candidateAllowed,
          shadowDifference: input.shadowDifference,
          operationExternalId: input.actor.operationExternalId,
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to emit Mainserver authorization audit', {
      operation: 'mainserver_authorization_audit',
      instance_id: input.actor.instanceId,
      operation_external_id: input.actor.operationExternalId,
      action_id: input.action,
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
};

const toMutationAuthorization = (
  actor: MainserverMutationActor,
  decision: Omit<MainserverMutationAuthorization, 'operationExternalId'>
): MainserverMutationAuthorization => ({
  ...decision,
  operationExternalId: actor.operationExternalId,
});

export const authorizeMainserverCreateForPrincipal = async (input: {
  readonly actor: MainserverMutationActor;
  readonly action: string;
  readonly contentType: string;
}): Promise<MainserverMutationAuthorization | Response> => {
  const permissions = await loadMutationPermissions(input.actor);
  if (!permissions.ok) {
    return errorJson(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.');
  }
  const decision = authorizeMainserverCreatePrincipal({
    instanceId: input.actor.instanceId,
    keycloakSubject: input.actor.keycloakSubject,
    actorAccountId: input.actor.actorAccountId,
    ...(input.actor.activeOrganizationId
      ? { activeOrganizationId: input.actor.activeOrganizationId }
      : {}),
    action: input.action,
    contentType: input.contentType,
    permissions: permissions.permissions,
    actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
  });
  await emitMainserverMutationAuthorizationAudit({
    actor: input.actor,
    action: input.action,
    contentType: input.contentType,
    authorizationMode: decision.authorizationMode,
    resolverMode: decision.resolverMode,
    candidateAuthorizationMode: decision.candidateAuthorizationMode,
    candidateAllowed: decision.candidateAllowed,
    shadowDifference: decision.shadowDifference,
    allowed: decision.allowed,
    ...(!decision.allowed ? { reasonCode: decision.reason } : {}),
  });
  if (!decision.allowed) {
    return errorJson(403, 'forbidden', 'Keine Berechtigung für diesen Mutationsprincipal.');
  }

  await beginMainserverMutationJournal({
    instanceId: input.actor.instanceId,
    operationExternalId: input.actor.operationExternalId,
    actorAccountId: input.actor.actorAccountId,
    actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
    actingPrincipalId: input.actor.mutationPrincipalContext.actingPrincipalId,
    activeOrganizationId: input.actor.activeOrganizationId,
    credentialSource: input.actor.mutationPrincipalContext.credentialSource,
    credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
    actionId: input.action,
    contentType: input.contentType,
    authorizationMode: decision.authorizationMode,
    resolverMode: decision.resolverMode,
    candidateAuthorizationMode: decision.candidateAuthorizationMode,
    candidateAllowed: decision.candidateAllowed,
    shadowDifference: decision.shadowDifference,
  });
  return toMutationAuthorization(input.actor, decision);
};

type AuthorizationAggregate = {
  authorizationMode: MainserverMutationAuthorization['authorizationMode'];
  resolverMode: MainserverMutationAuthorization['resolverMode'];
  candidateAuthorizationMode?: MainserverMutationAuthorization['candidateAuthorizationMode'];
  candidateAllowed?: boolean;
  shadowDifference: boolean;
};

type ProviderDecision = Awaited<ReturnType<typeof authorizeMainserverDataProviderAccess>>;

const mergeProviderDecision = (
  aggregate: AuthorizationAggregate,
  decision: ProviderDecision
): void => {
  if (decision.authorizationMode === 'credential_visible_compatibility') {
    aggregate.authorizationMode = decision.authorizationMode;
  }
  aggregate.resolverMode = decision.resolverMode;
  if (decision.candidateAuthorizationMode === 'credential_visible_compatibility') {
    aggregate.candidateAuthorizationMode = 'credential_visible_compatibility';
  } else if (decision.candidateAuthorizationMode === 'exact') {
    aggregate.candidateAuthorizationMode ??= 'exact';
  }
  if (typeof decision.candidateAllowed === 'boolean') {
    aggregate.candidateAllowed =
      aggregate.candidateAllowed === false ? false : decision.candidateAllowed;
  }
  aggregate.shadowDifference ||= decision.shadowDifference === true;
};

const providerDenialResponse = (decision: ProviderDecision): Response =>
  decision.reason === 'data_provider_missing'
    ? errorJson(
        502,
        decision.reason,
        'Der Mainserver hat für diesen Inhalt keinen DataProvider geliefert.'
      )
    : errorJson(403, decision.reason, 'Keine Berechtigung für den DataProvider dieses Inhalts.');

const evaluateProviderActions = async (input: {
  actor: MainserverMutationActor;
  actions: readonly string[];
  contentType: string;
  contentId: string;
  dataProviderId: string;
  permissions: Awaited<ReturnType<typeof loadMutationPermissions>> & { readonly ok: true };
}): Promise<AuthorizationAggregate | Response> => {
  const aggregate: AuthorizationAggregate = {
    authorizationMode: 'exact',
    resolverMode: 'automatic',
    shadowDifference: false,
  };
  for (const action of input.actions) {
    const decision = await authorizeMainserverDataProviderAccess({
      instanceId: input.actor.instanceId,
      keycloakSubject: input.actor.keycloakSubject,
      actorAccountId: input.actor.actorAccountId,
      actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
      credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
      ...(input.actor.activeOrganizationId
        ? { activeOrganizationId: input.actor.activeOrganizationId }
        : {}),
      action,
      contentType: input.contentType,
      contentId: input.contentId,
      permissions: input.permissions.permissions,
      dataProviderId: input.dataProviderId,
    });
    await emitMainserverMutationAuthorizationAudit({
      actor: input.actor,
      action,
      contentType: input.contentType,
      contentId: input.contentId,
      dataProviderId: input.dataProviderId,
      authorizationMode: decision.authorizationMode,
      resolverMode: decision.resolverMode,
      candidateAuthorizationMode: decision.candidateAuthorizationMode,
      candidateAllowed: decision.candidateAllowed,
      shadowDifference: decision.shadowDifference,
      allowed: decision.allowed,
      ...(!decision.allowed ? { reasonCode: decision.reason } : {}),
    });
    if (!decision.allowed) return providerDenialResponse(decision);
    mergeProviderDecision(aggregate, decision);
  }
  return aggregate;
};

const beginExistingContentJournal = async (input: {
  actor: MainserverMutationActor;
  action: string;
  contentType: string;
  contentId: string;
  item: DataProviderBearingItem | undefined;
  dataProviderId: string;
  authorization: AuthorizationAggregate;
}): Promise<void> => {
  await beginMainserverMutationJournal({
    instanceId: input.actor.instanceId,
    operationExternalId: input.actor.operationExternalId,
    actorAccountId: input.actor.actorAccountId,
    actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
    actingPrincipalId: input.actor.mutationPrincipalContext.actingPrincipalId,
    activeOrganizationId: input.actor.activeOrganizationId,
    credentialSource: input.actor.mutationPrincipalContext.credentialSource,
    credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
    actionId: input.action,
    contentType: input.contentType,
    contentId: input.contentId,
    observedDataProviderId: input.dataProviderId,
    ...input.authorization,
    preimage: {
      id: input.item?.id ?? input.contentId,
      dataProviderId: input.dataProviderId,
      ...(input.item?.dataProvider?.name ? { dataProviderName: input.item.dataProvider.name } : {}),
    },
  });
};

export const authorizeMainserverExistingContent = async (input: {
  readonly actor: MainserverMutationActor;
  readonly action: string;
  readonly contentType: string;
  readonly contentId: string;
  readonly item: DataProviderBearingItem | undefined;
  readonly additionalActions?: readonly string[];
}): Promise<MainserverMutationAuthorization | Response> => {
  const permissions = await loadMutationPermissions(input.actor);
  if (!permissions.ok) {
    return errorJson(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.');
  }
  const dataProviderId = input.item?.dataProvider?.id?.trim() ?? '';
  const actions = [...new Set([input.action, ...(input.additionalActions ?? [])])];
  const authorization = await evaluateProviderActions({
    actor: input.actor,
    actions,
    contentType: input.contentType,
    contentId: input.contentId,
    dataProviderId,
    permissions,
  });
  if (authorization instanceof Response) return authorization;

  await beginExistingContentJournal({
    actor: input.actor,
    action: actions[actions.length - 1] ?? input.action,
    contentType: input.contentType,
    contentId: input.contentId,
    item: input.item,
    dataProviderId,
    authorization,
  });
  return toMutationAuthorization(input.actor, {
    authorizationMode: authorization.authorizationMode,
    resolverMode: authorization.resolverMode,
    ...(authorization.candidateAuthorizationMode
      ? { candidateAuthorizationMode: authorization.candidateAuthorizationMode }
      : {}),
    ...(typeof authorization.candidateAllowed === 'boolean'
      ? { candidateAllowed: authorization.candidateAllowed }
      : {}),
    ...(authorization.shadowDifference ? { shadowDifference: true } : {}),
  });
};
