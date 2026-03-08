import type { SessionUser } from '../types';
import { createSdkLogger } from '@sva/sdk/server';

import { getAuthConfig } from '../config';
import { client, getOidcConfig } from '../oidc.server';
import { deleteSession, getSession, updateSession } from '../redis-session.server';
import { isTokenErrorLike } from '../shared/error-guards';
import { buildLogContext } from '../shared/log-context';
import { buildSessionUser, resolveExpiresAt, TOKEN_REFRESH_SKEW_MS } from './shared';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldRefreshSession = (expiresAt: number | undefined): boolean =>
  typeof expiresAt === 'number' && expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;

const refreshSession = async (sessionId: string, refreshToken: string, fallbackExpiresAt?: number) => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const refreshed = await client.refreshTokenGrant(config, refreshToken);
  const updatedUser = buildSessionUser({
    accessToken: refreshed.access_token,
    claims: (refreshed.claims() ?? {}) as Record<string, unknown>,
    clientId: authConfig.clientId,
  });

  await updateSession(sessionId, {
    user: updatedUser,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? refreshToken,
    idToken: refreshed.id_token,
    expiresAt: resolveExpiresAt(refreshed.expiresIn(), fallbackExpiresAt),
  });

  return updatedUser;
};

const handleRefreshFailure = async (input: {
  error: unknown;
  sessionId: string;
  refreshToken?: string;
  expiresAt?: number;
  workspaceId?: string;
  fallbackUser: SessionUser | null;
}): Promise<SessionUser | null> => {
  const now = Date.now();
  if (isTokenErrorLike(input.error)) {
    logger.warn('Token validation/refresh failed', {
      operation: 'refresh_token',
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      has_refresh_token: Boolean(input.refreshToken),
      session_expired: input.expiresAt ? input.expiresAt < now : false,
      ...buildLogContext(input.workspaceId),
    });
  } else {
    logger.error('Token refresh failed', {
      operation: 'refresh_token',
      error: input.error instanceof Error ? input.error.message : String(input.error),
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      session_expired: input.expiresAt ? input.expiresAt < now : false,
      ...buildLogContext(input.workspaceId),
    });
  }

  if (input.expiresAt && input.expiresAt < now) {
    await deleteSession(input.sessionId);
    return null;
  }

  return input.fallbackUser;
};

export const getSessionUser = async (sessionId: string) => {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  if (!shouldRefreshSession(session.expiresAt)) {
    return session.user ?? null;
  }

  if (!session.refreshToken) {
    if (session.expiresAt && session.expiresAt < Date.now()) {
      await deleteSession(sessionId);
      return null;
    }
    return session.user ?? null;
  }

  try {
    logger.debug('Refreshing access token for session', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(session.user?.instanceId),
    });

    await refreshSession(sessionId, session.refreshToken, session.expiresAt);
    const updatedSession = await getSession(sessionId);

    logger.debug('Token refresh succeeded', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(updatedSession?.user?.instanceId),
    });

    return updatedSession?.user ?? null;
  } catch (error) {
    return handleRefreshFailure({
      error,
      sessionId,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      workspaceId: session.user?.instanceId,
      fallbackUser: session.user ?? null,
    });
  }
};
