import {
  authorizeMainserverCreatePrincipal,
  resolveEffectivePermissions,
} from '@sva/auth-runtime/server';

import { errorJson } from './content-route-core.js';
import { emitMainserverMutationAuthorizationAudit } from './mutation-principal-authorization-audit.js';
import type { MainserverMutationActor } from './mutation-principal-types.js';

export const authorizeMainserverActionPreflight = async (input: {
  readonly actor: MainserverMutationActor;
  readonly action: string;
  readonly contentType: string;
  readonly contentId: string;
}): Promise<Response | null> => {
  const permissions = await resolveEffectivePermissions({
    instanceId: input.actor.instanceId,
    keycloakSubject: input.actor.keycloakSubject,
    ...(input.actor.activeOrganizationId
      ? { organizationId: input.actor.activeOrganizationId }
      : {}),
  });
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
