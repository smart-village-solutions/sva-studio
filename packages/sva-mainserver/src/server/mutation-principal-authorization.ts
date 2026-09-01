import {
  authorizeMainserverCreatePrincipal,
  authorizeMainserverDataProviderAccess,
  beginMainserverMutationJournal,
  readMainserverScopeResolverMode,
  resolveEffectivePermissions,
} from '@sva/auth-runtime/server';

import { errorJson } from './content-route-core.js';
import { emitMainserverMutationAuthorizationAudit } from './mutation-principal-authorization-audit.js';
import type {
  DataProviderBearingItem,
  MainserverMutationActor,
  MainserverMutationAuthorization,
} from './mutation-principal-types.js';
import { selectMainserverActionAccessScopePermissions } from './mutation-principal-permission-scope.js';

const loadMutationPermissions = async (actor: MainserverMutationActor) =>
  resolveEffectivePermissions({
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
    ...(actor.activeOrganizationId ? { organizationId: actor.activeOrganizationId } : {}),
  });

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

export const authorizeMainserverActionPreflight = async (input: {
  readonly actor: MainserverMutationActor;
  readonly action: string;
  readonly contentType: string;
  readonly contentId: string;
}): Promise<Response | null> => {
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
    contentId: input.contentId,
    permissions: permissions.permissions,
    actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
  });
  await emitMainserverMutationAuthorizationAudit({
    actor: input.actor,
    action: input.action,
    contentType: input.contentType,
    contentId: input.contentId,
    authorizationMode: decision.authorizationMode,
    resolverMode: decision.resolverMode,
    candidateAuthorizationMode: decision.candidateAuthorizationMode,
    candidateAllowed: decision.candidateAllowed,
    shadowDifference: decision.shadowDifference,
    allowed: decision.allowed,
    ...(!decision.allowed ? { reasonCode: decision.reason } : {}),
  });
  return decision.allowed
    ? null
    : errorJson(403, 'forbidden', 'Keine Berechtigung zur Übertragung dieses Inhalts.');
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
    : decision.reason === 'database_unavailable' ||
        decision.reason === 'identity_provider_unavailable'
      ? errorJson(503, decision.reason, 'Die DataProvider-Bindung konnte nicht geprüft werden.')
      : errorJson(403, decision.reason, 'Keine Berechtigung für den DataProvider dieses Inhalts.');
const evaluateProviderActions = async (input: {
  actor: MainserverMutationActor;
  actions: readonly string[];
  contentType: string;
  contentId: string;
  dataProviderId: string;
  permissions: Awaited<ReturnType<typeof loadMutationPermissions>> & { readonly ok: true };
  forceExactScopeAuthorization: boolean;
  requireAllScopeActions?: readonly string[];
}): Promise<AuthorizationAggregate | Response> => {
  const aggregate: AuthorizationAggregate = {
    authorizationMode: 'exact',
    resolverMode: 'automatic',
    shadowDifference: false,
  };
  const requireAllScopeActions = new Set(input.requireAllScopeActions ?? []);
  for (const action of input.actions) {
    const actionPermissions = requireAllScopeActions.has(action)
      ? selectMainserverActionAccessScopePermissions(
          input.permissions.permissions,
          action,
          'content',
          'all'
        )
      : input.permissions.permissions;
    const decision = await authorizeMainserverDataProviderAccess({
      instanceId: input.actor.instanceId,
      keycloakSubject: input.actor.keycloakSubject,
      actorAccountId: input.actor.actorAccountId,
      actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
      credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
      ...(input.actor.mutationPrincipalContext.contentAuthorPolicy
        ? { contentAuthorPolicy: input.actor.mutationPrincipalContext.contentAuthorPolicy }
        : {}),
      ...(input.actor.activeOrganizationId
        ? { activeOrganizationId: input.actor.activeOrganizationId }
        : {}),
      action,
      contentType: input.contentType,
      contentId: input.contentId,
      permissions: actionPermissions,
      dataProviderId: input.dataProviderId,
      ...(input.forceExactScopeAuthorization ? { forceExactScopeAuthorization: true } : {}),
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
  readonly requiredAccessScope?: 'all';
  readonly forceExactScopeAuthorization?: boolean;
}): Promise<MainserverMutationAuthorization | Response> => {
  const permissions = await loadMutationPermissions(input.actor);
  if (!permissions.ok) {
    return errorJson(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.');
  }
  if (
    input.requiredAccessScope === 'all' &&
    selectMainserverActionAccessScopePermissions(
      permissions.permissions,
      input.action,
      'content',
      'all'
    ).length === 0
  ) {
    await emitMainserverMutationAuthorizationAudit({
      actor: input.actor,
      action: input.action,
      contentType: input.contentType,
      contentId: input.contentId,
      dataProviderId: input.item?.dataProvider?.id?.trim(),
      authorizationMode: 'exact',
      resolverMode: readMainserverScopeResolverMode(),
      allowed: false,
      reasonCode: 'access_scope_mismatch',
    });
    return errorJson(
      403,
      'content_transfer_permission_missing',
      'Für Inhalte ohne auflösbaren Inhaber ist die globale Transferberechtigung erforderlich.'
    );
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
    forceExactScopeAuthorization: input.forceExactScopeAuthorization === true,
    ...(input.requiredAccessScope === 'all' ? { requireAllScopeActions: [input.action] } : {}),
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
