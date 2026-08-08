import { evaluateAuthorizeDecision, type EffectivePermission } from '@sva/iam-core';

import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';
import {
  loadCurrentMainserverDataProviderBinding,
  type MainserverDataProviderBinding,
} from './mainserver-data-provider-bindings.js';
import {
  buildAuthorizeRequest,
  resolveCredentialVisibleCompatibilityDecision,
} from './server-authorization.model.js';

export type MainserverContentAuthorizationMode = 'credential_visible_compatibility' | 'exact';

export type MainserverScopeResolverMode = 'automatic' | 'compatibility' | 'shadow';

export const readMainserverScopeResolverMode = (): MainserverScopeResolverMode => {
  const configured = process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE?.trim().toLowerCase();
  return configured === 'automatic' || configured === 'compatibility' || configured === 'shadow'
    ? configured
    : 'shadow';
};

export type MainserverContentAuthorizationDecision = Readonly<{
  allowed: boolean;
  authorizationMode: MainserverContentAuthorizationMode;
  reason: 'allowed' | 'data_provider_mismatch' | 'data_provider_missing' | 'forbidden';
  resolverMode: MainserverScopeResolverMode;
  candidateAuthorizationMode?: MainserverContentAuthorizationMode;
  candidateAllowed?: boolean;
  shadowDifference?: boolean;
}>;

type AuthorizationContext = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  actorAccountId: string;
  activeOrganizationId?: string;
  action: string;
  contentType: string;
  contentId?: string;
  permissions: readonly EffectivePermission[];
}>;

type BoundAuthorizationContext = AuthorizationContext &
  Readonly<{
    actingPrincipalType: 'organization' | 'user';
    credentialFingerprint: string;
  }>;

const buildRequest = (
  input: AuthorizationContext,
  ownership: Readonly<{ ownerUserId?: string; ownerOrganizationId?: string }> = {}
) =>
  buildAuthorizeRequest({
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    action: input.action,
    resource: {
      contentType: input.contentType,
      ...(input.contentId ? { contentId: input.contentId } : {}),
      ...(input.activeOrganizationId ? { organizationId: input.activeOrganizationId } : {}),
      ...ownership,
    },
    actorAccountId: input.actorAccountId,
  });

export const authorizeMainserverCreatePrincipal = (
  input: AuthorizationContext & Readonly<{ actingPrincipalType: 'organization' | 'user' }>
): MainserverContentAuthorizationDecision => {
  const request = buildRequest(
    input,
    input.actingPrincipalType === 'organization'
      ? {
          ...(input.activeOrganizationId
            ? { ownerOrganizationId: input.activeOrganizationId }
            : {}),
        }
      : { ownerUserId: input.actorAccountId }
  );
  const allowed = evaluateAuthorizeDecision(request, input.permissions).allowed;
  return {
    allowed,
    authorizationMode: 'exact',
    reason: allowed ? 'allowed' : 'forbidden',
    resolverMode: readMainserverScopeResolverMode(),
  };
};

const applyScopeResolverMode = (
  candidate: Omit<MainserverContentAuthorizationDecision, 'resolverMode'>,
  compatibilityAllowed: boolean
): MainserverContentAuthorizationDecision => {
  const resolverMode = readMainserverScopeResolverMode();
  if (resolverMode === 'automatic') {
    return { ...candidate, resolverMode };
  }

  const enforced = {
    allowed: compatibilityAllowed,
    authorizationMode: 'credential_visible_compatibility' as const,
    reason: compatibilityAllowed ? ('allowed' as const) : ('forbidden' as const),
  };
  if (resolverMode === 'compatibility') {
    return { ...enforced, resolverMode };
  }

  return {
    ...enforced,
    resolverMode,
    candidateAuthorizationMode: candidate.authorizationMode,
    candidateAllowed: candidate.allowed,
    shadowDifference:
      enforced.allowed !== candidate.allowed ||
      enforced.authorizationMode !== candidate.authorizationMode,
  };
};

const hasScopedPermission = (
  permissions: readonly EffectivePermission[],
  action: string,
  scope: 'organization' | 'own'
): boolean => {
  const resourceType = action.split('.')[0] ?? '';
  return permissions.some(
    (permission) =>
      permission.action === action &&
      permission.resourceType === resourceType &&
      permission.accessScope === scope
  );
};

const loadBinding = async (input: {
  readonly context: BoundAuthorizationContext;
  readonly principalType: 'organization' | 'user';
  readonly principalId: string;
}) => {
  if (input.principalType === input.context.actingPrincipalType) {
    return loadCurrentMainserverDataProviderBinding({
      instanceId: input.context.instanceId,
      principalType: input.principalType,
      principalId: input.principalId,
      credentialFingerprint: input.context.credentialFingerprint,
    });
  }

  const credentials = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.context.instanceId,
    keycloakSubject: input.context.keycloakSubject,
    activeOrganizationId: input.context.activeOrganizationId,
    actingPrincipalType: input.principalType,
  });
  if (credentials.status !== 'ok') {
    return undefined;
  }

  return loadCurrentMainserverDataProviderBinding({
    instanceId: input.context.instanceId,
    principalType: input.principalType,
    principalId: input.principalId,
    credentialFingerprint: credentials.credentialFingerprint,
  });
};

const resolveCompatibilityAllowed = (input: BoundAuthorizationContext): boolean => {
  const permissions = input.permissions.map((permission) =>
    permission.accessScope === 'own' || permission.accessScope === 'organization'
      ? { ...permission, accessScope: undefined }
      : permission
  );
  return resolveCredentialVisibleCompatibilityDecision(buildRequest(input), permissions);
};

type RelevantBindings = Readonly<{
  needsOwn: boolean;
  needsOrganization: boolean;
  user?: MainserverDataProviderBinding;
  organization?: MainserverDataProviderBinding;
}>;

const loadRelevantBindings = async (
  input: BoundAuthorizationContext
): Promise<RelevantBindings> => {
  const needsOwn = hasScopedPermission(input.permissions, input.action, 'own');
  const needsOrganization = hasScopedPermission(input.permissions, input.action, 'organization');
  const [user, organization] = await Promise.all([
    needsOwn || needsOrganization
      ? loadBinding({ context: input, principalType: 'user', principalId: input.actorAccountId })
      : undefined,
    needsOrganization && input.activeOrganizationId
      ? loadBinding({
          context: input,
          principalType: 'organization',
          principalId: input.activeOrganizationId,
        })
      : undefined,
  ]);
  return {
    needsOwn,
    needsOrganization,
    ...(user ? { user } : {}),
    ...(organization ? { organization } : {}),
  };
};

type AuthorizationCandidate = Omit<MainserverContentAuthorizationDecision, 'resolverMode'>;

const isAllowedForOwnership = (
  input: BoundAuthorizationContext,
  ownership: Readonly<{ ownerUserId?: string; ownerOrganizationId?: string }>
): boolean => evaluateAuthorizeDecision(buildRequest(input, ownership), input.permissions).allowed;

const resolveBoundAuthorizationCandidate = (
  input: BoundAuthorizationContext & Readonly<{ dataProviderId: string }>,
  bindings: RelevantBindings,
  compatibilityAllowed: boolean
): AuthorizationCandidate => {
  if (
    bindings.user?.dataProviderId === input.dataProviderId &&
    isAllowedForOwnership(input, { ownerUserId: input.actorAccountId })
  ) {
    return { allowed: true, authorizationMode: 'exact', reason: 'allowed' };
  }
  if (
    input.activeOrganizationId &&
    bindings.organization?.dataProviderId === input.dataProviderId &&
    isAllowedForOwnership(input, { ownerOrganizationId: input.activeOrganizationId })
  ) {
    return { allowed: true, authorizationMode: 'exact', reason: 'allowed' };
  }

  const ownReady = !bindings.needsOwn || Boolean(bindings.user);
  const organizationReady =
    !bindings.needsOrganization ||
    (input.activeOrganizationId
      ? Boolean(bindings.user && bindings.organization)
      : Boolean(bindings.user));
  if (ownReady && organizationReady) {
    return { allowed: false, authorizationMode: 'exact', reason: 'data_provider_mismatch' };
  }
  return {
    allowed: compatibilityAllowed,
    authorizationMode: 'credential_visible_compatibility',
    reason: compatibilityAllowed ? 'allowed' : 'forbidden',
  };
};

export const authorizeMainserverDataProviderAccess = async (
  input: BoundAuthorizationContext & Readonly<{ dataProviderId: string }>
): Promise<MainserverContentAuthorizationDecision> => {
  const providerId = input.dataProviderId.trim();
  if (!providerId) {
    return {
      allowed: false,
      authorizationMode: 'exact',
      reason: 'data_provider_missing',
      resolverMode: readMainserverScopeResolverMode(),
    };
  }

  const unownedRequest = buildRequest(input);
  if (evaluateAuthorizeDecision(unownedRequest, input.permissions).allowed) {
    return {
      allowed: true,
      authorizationMode: 'exact',
      reason: 'allowed',
      resolverMode: readMainserverScopeResolverMode(),
    };
  }

  const compatibilityAllowed = resolveCompatibilityAllowed(input);
  const bindings = await loadRelevantBindings(input);
  return applyScopeResolverMode(
    resolveBoundAuthorizationCandidate(
      { ...input, dataProviderId: providerId },
      bindings,
      compatibilityAllowed
    ),
    compatibilityAllowed
  );
};
