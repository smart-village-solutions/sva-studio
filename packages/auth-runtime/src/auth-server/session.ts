import { createSdkLogger } from '@sva/server-runtime';

import { getAuthConfig, resolveAuthConfigFromSessionAuth } from '../config.js';
import { isTokenErrorLike } from '../error-guards.js';
import { buildLogContext } from '../log-context.js';
import { SessionStoreUnavailableError } from '../runtime-errors.js';
import type { RuntimeScopeRef, Session, SessionUser } from '../types.js';

import { deleteSession, getSession, getSessionControlState, updateSession } from '../redis-session.js';
import { refreshSession } from './session-refresh.js';
import { buildSessionUser, TOKEN_REFRESH_SKEW_MS } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldRefreshSession = (expiresAt: number | undefined): boolean =>
  typeof expiresAt === 'number' && expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;

const needsSessionUserHydration = (
  user: SessionUser | null | undefined,
  scope?: RuntimeScopeRef
): boolean =>
  !user?.id || (scope?.kind === 'instance' && user.instanceId !== scope.instanceId);

export type SessionResolutionFailureReason =
  | 'invalid_session'
  | 'session_expired'
  | 'forced_reauth'
  | 'token_refresh_failed_after_expiry';

export type SessionResolutionResult =
  | {
      kind: 'authenticated';
      user: SessionUser | null;
      expiresAt?: number;
      freshReauthAt?: number;
      activeOrganizationId?: string;
    }
  | { kind: 'invalid'; reason: SessionResolutionFailureReason };

const readSessionInvalidationReason = async (
  session: Session
): Promise<Extract<SessionResolutionResult, { kind: 'invalid' }>['reason'] | null> => {
  const state = await getSessionControlState(session.userId);
  if (!state) {
    return null;
  }

  if (state.loginBlocked === true) {
    return 'forced_reauth';
  }

  const sessionVersion = session.sessionVersion ?? 1;
  const issuedAt = session.issuedAt ?? session.createdAt;

  if (
    typeof state.minimumSessionVersion === 'number' &&
    sessionVersion < state.minimumSessionVersion
  ) {
    return 'forced_reauth';
  }

  if (typeof state.forcedReauthAt === 'number' && issuedAt < state.forcedReauthAt) {
    return 'forced_reauth';
  }

  return null;
};

const logIncompleteSessionUser = (
  user: SessionUser | null | undefined,
  source: 'session_read' | 'access_token_hydrate' | 'token_refresh',
  scope: RuntimeScopeRef | undefined = user?.instanceId
    ? { kind: 'instance', instanceId: user.instanceId }
    : undefined
) => {
  if (!needsSessionUserHydration(user, scope)) {
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
  if (!session.accessToken || !needsSessionUserHydration(session.user, session.auth)) {
    return session.user ?? null;
  }

  const authConfig = session.auth
    ? resolveAuthConfigFromSessionAuth(session.auth)
    : getAuthConfig();
  const hydratedUser = buildSessionUser({
    accessToken: session.accessToken,
    claims: {},
    clientId: authConfig.clientId,
    scope: session.auth,
  });

  if (needsSessionUserHydration(hydratedUser, session.auth)) {
    logIncompleteSessionUser(session.user, 'access_token_hydrate', session.auth);
    return session.user ?? null;
  }

  await updateSession(sessionId, { user: hydratedUser });

  logger.info('Session user hydrated from access token', {
    operation: 'session_user_hydrate',
    hydration_source: 'access_token',
    had_instance_id: Boolean(session.user?.instanceId),
    had_roles: (session.user?.roles.length ?? 0) > 0,
    ...buildLogContext(
      hydratedUser.instanceId
        ? { kind: 'instance', instanceId: hydratedUser.instanceId }
        : session.auth
    ),
  });

  return hydratedUser;
};

const handleRefreshFailure = async (input: {
  error: unknown;
  sessionId: string;
  refreshToken?: string;
  expiresAt?: number;
  freshReauthAt?: number;
  scope?: Session['auth'];
  fallbackUser: SessionUser | null;
}): Promise<SessionResolutionResult> => {
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
    return { kind: 'invalid', reason: 'token_refresh_failed_after_expiry' };
  }

  return {
    kind: 'authenticated',
    user: input.fallbackUser,
    expiresAt: input.expiresAt,
    freshReauthAt: input.freshReauthAt,
  };
};

export const resolveSessionUser = async (sessionId: string): Promise<SessionResolutionResult> => {
  const session = await getSession(sessionId);
  if (!session) {
    return { kind: 'invalid', reason: 'invalid_session' };
  }

  const sessionInvalidationReason = await readSessionInvalidationReason(session);
  if (sessionInvalidationReason) {
    await deleteSession(sessionId);
    return { kind: 'invalid', reason: sessionInvalidationReason };
  }

  if (!shouldRefreshSession(session.expiresAt)) {
    const user = await hydrateSessionUserFromAccessToken(sessionId, session);
    logIncompleteSessionUser(user, 'session_read', session.auth);
    const result = {
      kind: 'authenticated',
      user,
      expiresAt: session.expiresAt,
      freshReauthAt: session.freshReauthAt,
      ...(session.activeOrganizationId
        ? { activeOrganizationId: session.activeOrganizationId }
        : {}),
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    return result;
  }

  if (!session.refreshToken) {
    if (session.expiresAt && session.expiresAt < Date.now()) {
      await deleteSession(sessionId);
      return { kind: 'invalid', reason: 'session_expired' };
    }
    const result = {
      kind: 'authenticated',
      user: await hydrateSessionUserFromAccessToken(sessionId, session),
      expiresAt: session.expiresAt,
      freshReauthAt: session.freshReauthAt,
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    return result;
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

    const result = {
      kind: 'authenticated',
      user: updatedSession?.user ?? null,
      expiresAt: updatedSession?.expiresAt,
      freshReauthAt: updatedSession?.freshReauthAt,
      ...(updatedSession?.activeOrganizationId
        ? { activeOrganizationId: updatedSession.activeOrganizationId }
        : {}),
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    return result;
  } catch (error) {
    return handleRefreshFailure({
      error,
      sessionId,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      freshReauthAt: session.freshReauthAt,
      scope: session.auth,
      fallbackUser: session.user ?? null,
    });
  }
};

export const getSessionUser = async (sessionId: string) => {
  const result = await resolveSessionUser(sessionId);
  return result.kind === 'authenticated' ? result.user : null;
};
