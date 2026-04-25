import { extractRoles, parseJwtPayload, resolveInstanceId } from '@sva/core';

import { TenantScopeConflictError } from '@sva/auth/server';
import type { RuntimeScopeRef, SessionUser } from '../types.js';

export const TOKEN_REFRESH_SKEW_MS = 60_000;

const readClaimString = (claims: Record<string, unknown>, key: string): string | undefined =>
  typeof claims[key] === 'string' ? claims[key] : undefined;

export const buildSessionUser = (input: {
  accessToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
  scope?: RuntimeScopeRef;
}): SessionUser => {
  const accessTokenClaims = input.accessToken ? parseJwtPayload(input.accessToken) : null;
  const claims = { ...accessTokenClaims, ...input.claims };
  const roleClaims = accessTokenClaims ?? input.claims;
  const preferredUsername = readClaimString(claims, 'preferred_username');
  const username = readClaimString(claims, 'username');
  const tokenInstanceIds = [accessTokenClaims, input.claims]
    .map((claimSet) => (claimSet ? resolveInstanceId(claimSet) : undefined))
    .filter((value): value is string => typeof value === 'string');
  const expectedInstanceId = input.scope?.kind === 'instance' ? input.scope.instanceId : undefined;
  const scopedInstanceId =
    expectedInstanceId
      ? expectedInstanceId
      : input.scope?.kind === 'platform'
        ? undefined
        : resolveInstanceId(claims);

  if (expectedInstanceId) {
    const conflictingInstanceId = tokenInstanceIds.find((instanceId) => instanceId !== expectedInstanceId);
    if (conflictingInstanceId) {
      throw new TenantScopeConflictError({
        actualInstanceId: conflictingInstanceId,
        expectedInstanceId,
      });
    }
  }

  return {
    id: String(claims.sub ?? ''),
    instanceId: scopedInstanceId,
    roles: extractRoles(roleClaims, input.clientId),
    username: preferredUsername ?? username,
    email: readClaimString(claims, 'email'),
    firstName: readClaimString(claims, 'given_name'),
    lastName: readClaimString(claims, 'family_name'),
    displayName: readClaimString(claims, 'name') ?? preferredUsername,
  };
};

export const resolveExpiresAt = (expiresInSeconds: number | undefined, fallback?: number): number | undefined => {
  if (!expiresInSeconds) {
    return fallback;
  }

  return Date.now() + expiresInSeconds * 1000;
};

export const resolveSessionExpiry = (input: {
  expiresInSeconds: number | undefined;
  issuedAt: number;
  sessionTtlMs: number;
  fallback?: number;
}): number | undefined => {
  const tokenExpiresAt = resolveExpiresAt(input.expiresInSeconds, input.fallback);
  const absoluteSessionExpiresAt = input.issuedAt + input.sessionTtlMs;

  if (typeof tokenExpiresAt !== 'number') {
    return absoluteSessionExpiresAt;
  }

  return Math.min(tokenExpiresAt, absoluteSessionExpiresAt);
};
