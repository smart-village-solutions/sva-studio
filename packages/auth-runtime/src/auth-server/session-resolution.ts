import { createSdkLogger } from '@sva/server-runtime';

import { getAuthConfig, resolveAuthConfigFromSessionAuth } from '../config.js';
import { isTokenErrorLike } from '../error-guards.js';
import { buildLogContext } from '../log-context.js';
import { deleteSession, getSession, getSessionControlState, updateSession } from '../redis-session.js';
import {
  SessionNotFoundError,
  SessionStoreConflictError,
  SessionStoreUnavailableError,
  SessionTokenConflictError,
} from '../runtime-errors.js';
import type { RuntimeScopeRef, Session, SessionUser } from '../types.js';
import { refreshSession } from './session-refresh.js';
import { buildSessionUser, TOKEN_REFRESH_SKEW_MS } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const isAuthorizeTimingDebugEnabled = (): boolean =>
  process.env.IAM_DEBUG_AUTHORIZE_TIMINGS === 'true';

export type SessionResolutionTimingDiagnostics = {
  controlStateCacheStatus: 'hit_absent' | 'miss_absent' | 'not_checked' | 'present';
  controlStateMs: number; deleteSessionMs: number; getSessionMs: number;
  hydrateUserMs: number; refreshMs: number; refreshSessionReadMs: number;
};

export const createSessionResolutionTimingDiagnostics =
  (): SessionResolutionTimingDiagnostics => ({
    controlStateCacheStatus: 'not_checked',
    controlStateMs: 0,
    deleteSessionMs: 0,
    getSessionMs: 0,
    hydrateUserMs: 0,
    refreshMs: 0,
    refreshSessionReadMs: 0,
  });

export type SessionResolutionFailureReason =
  | 'invalid_session' | 'session_expired' | 'forced_reauth' | 'token_refresh_failed_after_expiry';

export type SessionResolutionResult =
  | {
      kind: 'authenticated'; user: SessionUser | null; expiresAt?: number;
      freshReauthAt?: number; activeOrganizationId?: string;
    }
  | { kind: 'invalid'; reason: SessionResolutionFailureReason };

const getFreshInvalidationReason = async (
  session: Session,
  diagnostics: SessionResolutionTimingDiagnostics
): Promise<SessionResolutionFailureReason | null> => {
  const startedAt = performance.now();
  const state = await getSessionControlState(session.userId);
  diagnostics.controlStateMs += performance.now() - startedAt;
  diagnostics.controlStateCacheStatus = state ? 'present' : 'miss_absent';
  if (!state) return null;
  const sessionVersion = session.sessionVersion ?? 1;
  const issuedAt = session.issuedAt ?? session.createdAt;
  return state.loginBlocked === true ||
    (typeof state.minimumSessionVersion === 'number' &&
      sessionVersion < state.minimumSessionVersion) ||
    (typeof state.forcedReauthAt === 'number' && issuedAt < state.forcedReauthAt)
    ? 'forced_reauth'
    : null;
};

export const shouldRefreshSession = (expiresAt: number | undefined): boolean =>
  typeof expiresAt === 'number' && expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;

export const logSessionResolutionTimingIfEnabled = (input: {
  diagnostics: SessionResolutionTimingDiagnostics;
  reason?: SessionResolutionFailureReason | 'authenticated';
  session?: Session;
  startedAt: number;
}): void => {
  if (!isAuthorizeTimingDebugEnabled()) {
    return;
  }

  logger.info('Session resolution timing diagnostics', {
    operation: 'session_resolution_timing',
    result_reason: input.reason ?? 'authenticated',
    get_session_ms: Number(input.diagnostics.getSessionMs.toFixed(2)),
    control_state_ms: Number(input.diagnostics.controlStateMs.toFixed(2)),
    control_state_cache_status: input.diagnostics.controlStateCacheStatus,
    hydrate_user_ms: Number(input.diagnostics.hydrateUserMs.toFixed(2)),
    refresh_ms: Number(input.diagnostics.refreshMs.toFixed(2)),
    refresh_session_read_ms: Number(input.diagnostics.refreshSessionReadMs.toFixed(2)),
    delete_session_ms: Number(input.diagnostics.deleteSessionMs.toFixed(2)),
    total_ms: Number((performance.now() - input.startedAt).toFixed(2)),
    session_id_present: true,
    user_id: input.session?.userId ?? null,
    session_expires_at: input.session?.expiresAt ?? null,
    session_refresh_required: input.session ? shouldRefreshSession(input.session.expiresAt) : null,
    ...buildLogContext(input.session?.auth),
  });
};

const needsSessionUserHydration = (
  user: SessionUser | null | undefined,
  scope?: RuntimeScopeRef
): boolean => !user?.id || (scope?.kind === 'instance' && user.instanceId !== scope.instanceId);

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

  const authConfig = session.auth ? resolveAuthConfigFromSessionAuth(session.auth) : getAuthConfig();
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
      hydratedUser.instanceId ? { kind: 'instance', instanceId: hydratedUser.instanceId } : session.auth
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
  activeOrganizationId?: string;
}): Promise<SessionResolutionResult> => {
  if (
    input.error instanceof SessionStoreUnavailableError ||
    input.error instanceof SessionStoreConflictError
  ) {
    throw input.error;
  }

  if (input.error instanceof SessionNotFoundError) {
    logger.info('Session ended during token refresh', {
      operation: 'refresh_token',
      reason_code: 'session_ended_during_refresh',
      ...buildLogContext(input.scope),
    });
    return { kind: 'invalid', reason: 'invalid_session' };
  }

  const now = Date.now();
  const tokenError = isTokenErrorLike(input.error);
  logger[tokenError ? 'warn' : 'error'](tokenError ? 'Token validation/refresh failed' : 'Token refresh failed', {
    operation: 'refresh_token',
    error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
    ...(tokenError ? { has_refresh_token: Boolean(input.refreshToken) } : {}),
    session_expired: input.expiresAt ? input.expiresAt < now : false,
    reason_code: 'token_refresh_failed',
    ...buildLogContext(input.scope),
  });

  if (input.expiresAt && input.expiresAt < now) {
    await deleteSession(input.sessionId);
    return { kind: 'invalid', reason: 'token_refresh_failed_after_expiry' };
  }

  return {
    kind: 'authenticated',
    user: input.fallbackUser,
    expiresAt: input.expiresAt,
    freshReauthAt: input.freshReauthAt,
    ...(input.activeOrganizationId ? { activeOrganizationId: input.activeOrganizationId } : {}),
  };
};

const buildAuthenticatedSessionResult = (
  session: Session,
  user: SessionUser | null = session.user ?? null
): Extract<SessionResolutionResult, { kind: 'authenticated' }> => ({
  kind: 'authenticated',
  user,
  expiresAt: session.expiresAt,
  freshReauthAt: session.freshReauthAt,
  ...(session.activeOrganizationId ? { activeOrganizationId: session.activeOrganizationId } : {}),
});

export const resolveCurrentSessionUser = async (
  sessionId: string,
  session: Session,
  diagnostics: SessionResolutionTimingDiagnostics,
  startedAt: number
): Promise<Extract<SessionResolutionResult, { kind: 'authenticated' }>> => {
  let user = session.user ?? null;
  if (needsSessionUserHydration(user, session.auth) && session.accessToken) {
    const fullSessionStartedAt = performance.now();
    const fullSession = await getSession(sessionId, { decryptTokens: true });
    diagnostics.refreshSessionReadMs = performance.now() - fullSessionStartedAt;
    const hydrateStartedAt = performance.now();
    user = fullSession
      ? await hydrateSessionUserFromAccessToken(sessionId, fullSession)
      : (session.user ?? null);
    diagnostics.hydrateUserMs = performance.now() - hydrateStartedAt;
  }

  logIncompleteSessionUser(user, 'session_read', session.auth);
  const result = buildAuthenticatedSessionResult(session, user);
  logSessionResolutionTimingIfEnabled({
    diagnostics,
    reason: 'authenticated',
    session,
    startedAt,
  });
  return result;
};

export const resolveSessionWithoutRefreshToken = async (
  sessionId: string,
  session: Session,
  diagnostics: SessionResolutionTimingDiagnostics,
  startedAt: number
): Promise<SessionResolutionResult> => {
  if (session.expiresAt && session.expiresAt < Date.now()) {
    const deleteSessionStartedAt = performance.now();
    await deleteSession(sessionId);
    diagnostics.deleteSessionMs = performance.now() - deleteSessionStartedAt;
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'session_expired',
      session,
      startedAt,
    });
    return { kind: 'invalid', reason: 'session_expired' };
  }

  const hydrateStartedAt = performance.now();
  const user = await hydrateSessionUserFromAccessToken(sessionId, session);
  diagnostics.hydrateUserMs = performance.now() - hydrateStartedAt;
  const result = buildAuthenticatedSessionResult(session, user);
  logSessionResolutionTimingIfEnabled({
    diagnostics,
    reason: 'authenticated',
    session,
    startedAt,
  });
  return result;
};

export const refreshAndResolveSession = async (
  sessionId: string,
  session: Session,
  diagnostics: SessionResolutionTimingDiagnostics,
  startedAt: number
): Promise<SessionResolutionResult> => {
  try {
    logger.debug('Refreshing access token for session', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(session.auth),
    });

    const refreshStartedAt = performance.now();
    await refreshSession(sessionId);
    diagnostics.refreshMs = performance.now() - refreshStartedAt;
    const refreshSessionReadStartedAt = performance.now();
    const updatedSession = await getSession(sessionId, { decryptTokens: false });
    diagnostics.refreshSessionReadMs += performance.now() - refreshSessionReadStartedAt;
    logIncompleteSessionUser(updatedSession?.user ?? null, 'token_refresh', updatedSession?.auth);

    logger.debug('Token refresh succeeded', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(updatedSession?.auth),
    });

    if (!updatedSession) {
      logSessionResolutionTimingIfEnabled({ diagnostics, reason: 'invalid_session', startedAt });
      return { kind: 'invalid', reason: 'invalid_session' };
    }
    const result = buildAuthenticatedSessionResult(updatedSession);
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'authenticated',
      session: updatedSession ?? session,
      startedAt,
    });
    return result;
  } catch (error) {
    if (
      error instanceof SessionStoreUnavailableError ||
      error instanceof SessionStoreConflictError
    ) {
      throw error;
    }

    const currentSession = await getSession(sessionId, { decryptTokens: false });
    if (!currentSession) {
      const reason = session.expiresAt && session.expiresAt < Date.now()
        ? 'token_refresh_failed_after_expiry'
        : 'invalid_session';
      logSessionResolutionTimingIfEnabled({ diagnostics, reason, session, startedAt });
      return {
        kind: 'invalid',
        reason,
      };
    }

    const invalidationReason = await getFreshInvalidationReason(currentSession, diagnostics);
    if (invalidationReason) {
      await deleteSession(sessionId);
      logSessionResolutionTimingIfEnabled({
        diagnostics,
        reason: invalidationReason,
        session: currentSession,
        startedAt,
      });
      return { kind: 'invalid', reason: invalidationReason };
    }

    if (error instanceof SessionTokenConflictError) {
      logSessionResolutionTimingIfEnabled({
        diagnostics,
        reason: 'authenticated',
        session: currentSession,
        startedAt,
      });
      return buildAuthenticatedSessionResult(currentSession);
    }

    const result = await handleRefreshFailure({
      error,
      sessionId,
      refreshToken: currentSession.refreshToken,
      expiresAt: currentSession.expiresAt,
      freshReauthAt: currentSession.freshReauthAt,
      scope: currentSession.auth,
      fallbackUser: currentSession.user ?? null,
      activeOrganizationId: currentSession.activeOrganizationId,
    });
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: result.kind === 'invalid' ? result.reason : 'authenticated',
      session: currentSession,
      startedAt,
    });
    return result;
  }
};
