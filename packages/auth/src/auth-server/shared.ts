import { extractRoles, parseJwtPayload, resolveInstanceId } from '@sva/core';

import type { SessionUser } from '../types.js';

export const TOKEN_REFRESH_SKEW_MS = 60_000;

export const buildSessionUser = (input: {
  accessToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
}): SessionUser => {
  const accessTokenClaims = input.accessToken ? parseJwtPayload(input.accessToken) : null;
  const claims = { ...accessTokenClaims, ...input.claims };
  const roleClaims = accessTokenClaims ?? input.claims;

  return {
    id: String(claims.sub ?? ''),
    instanceId: resolveInstanceId(claims),
    roles: extractRoles(roleClaims, input.clientId),
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
