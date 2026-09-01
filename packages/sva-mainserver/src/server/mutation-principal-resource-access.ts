import {
  authorizeMainserverDataProviderAccess,
  resolveEffectivePermissions,
} from '@sva/auth-runtime/server';

import type {
  DataProviderBearingItem,
  MainserverMutationActor,
} from './mutation-principal-types.js';
import { hasMainserverActionAccessScope } from './mutation-principal-permission-scope.js';

export type MainserverResourceAccess = Readonly<Record<string, boolean>>;

export const resolveMainserverResourceAccess = async (input: {
  readonly actor: MainserverMutationActor;
  readonly actions: readonly string[];
  readonly contentId?: string;
  readonly contentType: string;
  readonly item: DataProviderBearingItem | undefined;
  readonly requireAllScopeActions?: readonly string[];
}): Promise<MainserverResourceAccess> => {
  const denied = Object.fromEntries(input.actions.map((action) => [action, false]));
  const permissions = await resolveEffectivePermissions({
    instanceId: input.actor.instanceId,
    keycloakSubject: input.actor.keycloakSubject,
    ...(input.actor.activeOrganizationId
      ? { organizationId: input.actor.activeOrganizationId }
      : {}),
  });
  if (!permissions.ok) return denied;

  const requireAllScopeActions = new Set(input.requireAllScopeActions ?? []);

  const dataProviderId = input.item?.dataProvider?.id?.trim() ?? '';
  const decisions = await Promise.all(
    input.actions.map(async (action) => {
      if (
        requireAllScopeActions.has(action) &&
        !hasMainserverActionAccessScope(permissions.permissions, action, 'all')
      ) {
        return [action, false] as const;
      }
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
        contentId: input.contentId ?? input.item?.id,
        permissions: permissions.permissions,
        dataProviderId,
      });
      return [action, decision.allowed] as const;
    })
  );
  return Object.fromEntries(decisions);
};
