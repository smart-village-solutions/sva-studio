import { createSdkLogger } from '@sva/server-runtime';

import {
  SessionStoreUnavailableError,
  buildLogContext,
  getAuthConfig,
  isTokenErrorLike,
  resolveAuthConfigFromSessionAuth,
} from '@sva/auth/server';
import type { RuntimeScopeRef, Session, SessionUser } from '../types.js';

import { client, getOidcConfig } from '../oidc.js';
import { deleteSession, getSession, getSessionControlState, updateSession } from '../redis-session.js';
import { buildSessionUser, resolveSessionExpiry, TOKEN_REFRESH_SKEW_MS } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldRefreshSession = (expiresAt: number | undefined): boolean =>
  typeof expiresAt === 'number' && expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;

const needsSessionUserHydration = (user: SessionUser | null | undefined): boolean =>
  !user?.instanceId || user.roles.length === 0;

const isSessionAllowed = async (session: Session): Promise<boolean> => {
  const state = await getSessionControlState(session.userId);
  if (!state) {
    return true;
  }

  const sessionVersion = session.sessionVersion ?? 1;
  const issuedAt = session.issuedAt ?? session.createdAt;

  if (typeof state.minimumSessionVersion === 'number' && sessionVersion < state.minimumSessionVersion) {
    return false;
  }

  if (typeof state.forcedReauthAt === 'number' && issuedAt < state.forcedReauthAt) {
    return false;
  }

  return true;
};

const logIncompleteSessionUser = (
  user: SessionUser | null | undefined,
  source: 'session_read' | 'access_token_hydrate' | 'token_refresh',
  scope: RuntimeScopeRef | undefined = user?.instanceId
    ? { kind: 'instance', instanceId: user.instanceId }
    : undefined
) => {
  if (!needsSessionUserHydration(user)) {
    return;
  }

  logger.warn('Session user is missing required IAM context', {
    operation: 'session_user_diagnostics',
    source,
    user_id: user?.id ?? null,
    has_instance_id: Boolean(user?.instanceId),
    roles_count: user?.roles.length ?? 0,
    ...buildLogContext(scope),
  });
};

const hydrateSessionUserFromAccessToken = async (
  sessionId: string,
  session: { user?: SessionUser; accessToken?: string; auth?: Session['auth'] }
): Promise<SessionUser | null> => {
  if (!session.accessToken || !needsSessionUserHydration(session.user)) {
    return session.user ?? null;
  }

  const authConfig = session.auth ? resolveAuthConfigFromSessionAuth(session.auth) : getAuthConfig();
  const hydratedUser = buildSessionUser({
    accessToken: session.accessToken,
    claims: {},
    clientId: authConfig.clientId,
    scope: session.auth,
  });

  if (!hydratedUser.id || needsSessionUserHydration(hydratedUser)) {
    logIncompleteSessionUser(session.user, 'access_token_hydrate', session.auth);
    return session.user ?? null;
  }

  await updateSession(sessionId, { user: hydratedUser });

  logger.info('Session user hydrated from access token', {
    operation: 'session_user_hydrate',
    hydration_source: 'access_token',
    had_instance_id: Boolean(session.user?.instanceId),
    had_roles: (session.user?.roles.length ?? 0) > 0,
    ...buildLogContext(hydratedUser.instanceId ? { kind: 'instance', instanceId: hydratedUser.instanceId } : session.auth),
  });

  return hydratedUser;
};

const refreshSession = async (sessionId: string, session: Session) => {
  const authConfig = session.auth ? resolveAuthConfigFromSessionAuth(session.auth) : getAuthConfig();
  const config = await getOidcConfig(authConfig);
  const refreshed = await client.refreshTokenGrant(config, session.refreshToken ?? '');
  const updatedUser = buildSessionUser({
    accessToken: refreshed.access_token,
    claims: (refreshed.claims() ?? {}) as Record<string, unknown>,
    clientId: authConfig.clientId,
    scope: session.auth,
  });

  await updateSession(sessionId, {
    user: updatedUser,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    idToken: refreshed.id_token,
    expiresAt: resolveSessionExpiry({
      expiresInSeconds: refreshed.expiresIn(),
      issuedAt: session.issuedAt ?? session.createdAt,
      sessionTtlMs: authConfig.sessionTtlMs,
      fallback: session.expiresAt,
    }),
  });

  return updatedUser;
};

const handleRefreshFailure = async (input: {
  error: unknown;
  sessionId: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: Session['auth'];
  fallbackUser: SessionUser | null;
}): Promise<SessionUser | null> => {
  if (input.error instanceof SessionStoreUnavailableError) {
    throw input.error;
  }

  const now = Date.now();
  if (isTokenErrorLike(input.error)) {
    logger.warn('Token validation/refresh failed', {
      operation: 'refresh_token',
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      has_refresh_token: Boolean(input.refreshToken),
      session_expired: input.expiresAt ? input.expiresAt < now : false,
      reason_code: 'token_refresh_failed',
      ...buildLogContext(input.scope),
    });
  } else {
    logger.error('Token refresh failed', {
      operation: 'refresh_token',
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      reason_code: 'token_refresh_failed',
      session_expired: input.expiresAt ? input.expiresAt < now : false,
      ...buildLogContext(input.scope),
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

  if (!(await isSessionAllowed(session))) {
    await deleteSession(sessionId);
    return null;
  }

  if (!shouldRefreshSession(session.expiresAt)) {
    const user = await hydrateSessionUserFromAccessToken(sessionId, session);
    logIncompleteSessionUser(user, 'session_read');
    return user;
  }

  if (!session.refreshToken) {
    if (session.expiresAt && session.expiresAt < Date.now()) {
      await deleteSession(sessionId);
      return null;
    }
    return hydrateSessionUserFromAccessToken(sessionId, session);
  }

  try {
    logger.debug('Refreshing access token for session', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(session.auth),
    });

    await refreshSession(sessionId, session);
    const updatedSession = await getSession(sessionId);
    logIncompleteSessionUser(updatedSession?.user ?? null, 'token_refresh', updatedSession?.auth);

    logger.debug('Token refresh succeeded', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(updatedSession?.auth),
    });

    return updatedSession?.user ?? null;
  } catch (error) {
    return handleRefreshFailure({
      error,
      sessionId,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      scope: session.auth,
      fallbackUser: session.user ?? null,
    });
  }
};
