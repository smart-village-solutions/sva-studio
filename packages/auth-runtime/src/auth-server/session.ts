import { createSdkLogger } from '@sva/server-runtime';

import { getAuthConfig, resolveAuthConfigFromSessionAuth } from '../config.js';
import { isTokenErrorLike } from '../error-guards.js';
import { buildLogContext } from '../log-context.js';
import { SessionStoreUnavailableError } from '../runtime-errors.js';
import type { RuntimeScopeRef, Session, SessionUser } from '../types.js';

import {
  deleteSession,
  getSession,
  getSessionControlState,
  updateSession,
} from '../redis-session.js';
import { refreshSession } from './session-refresh.js';
import { buildSessionUser, TOKEN_REFRESH_SKEW_MS } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const SESSION_CONTROL_ABSENT_CACHE_TTL_MS = 5_000;

const absentSessionControlCache = new Map<string, { readonly expiresAtMs: number }>();

const isAuthorizeTimingDebugEnabled = (): boolean =>
  process.env.IAM_DEBUG_AUTHORIZE_TIMINGS === 'true';

type SessionResolutionTimingDiagnostics = {
  controlStateCacheStatus: 'hit_absent' | 'miss_absent' | 'not_checked' | 'present';
  controlStateMs: number;
  deleteSessionMs: number;
  getSessionMs: number;
  hydrateUserMs: number;
  refreshMs: number;
  refreshSessionReadMs: number;
};

const createSessionResolutionTimingDiagnostics = (): SessionResolutionTimingDiagnostics => ({
  controlStateCacheStatus: 'not_checked',
  controlStateMs: 0,
  deleteSessionMs: 0,
  getSessionMs: 0,
  hydrateUserMs: 0,
  refreshMs: 0,
  refreshSessionReadMs: 0,
});

const logSessionResolutionTimingIfEnabled = (input: {
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

const shouldRefreshSession = (expiresAt: number | undefined): boolean =>
  typeof expiresAt === 'number' && expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;

const needsSessionUserHydration = (
  user: SessionUser | null | undefined,
  scope?: RuntimeScopeRef
): boolean => !user?.id || (scope?.kind === 'instance' && user.instanceId !== scope.instanceId);

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
  session: Session,
  diagnostics: SessionResolutionTimingDiagnostics
): Promise<Extract<SessionResolutionResult, { kind: 'invalid' }>['reason'] | null> => {
  const cachedAbsentControl = absentSessionControlCache.get(session.userId);
  const nowMs = Date.now();
  if (cachedAbsentControl && cachedAbsentControl.expiresAtMs > nowMs) {
    diagnostics.controlStateCacheStatus = 'hit_absent';
    return null;
  }

  if (cachedAbsentControl) {
    absentSessionControlCache.delete(session.userId);
  }

  const controlStateStartedAt = performance.now();
  const state = await getSessionControlState(session.userId);
  diagnostics.controlStateMs = performance.now() - controlStateStartedAt;
  if (!state) {
    diagnostics.controlStateCacheStatus = 'miss_absent';
    absentSessionControlCache.set(session.userId, {
      expiresAtMs: nowMs + SESSION_CONTROL_ABSENT_CACHE_TTL_MS,
    });
    return null;
  }

  absentSessionControlCache.delete(session.userId);
  diagnostics.controlStateCacheStatus = 'present';

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
  const startedAt = performance.now();
  const diagnostics = createSessionResolutionTimingDiagnostics();
  const getSessionStartedAt = performance.now();
  const session = await getSession(sessionId, { decryptTokens: false });
  diagnostics.getSessionMs = performance.now() - getSessionStartedAt;
  if (!session) {
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'invalid_session',
      startedAt,
    });
    return { kind: 'invalid', reason: 'invalid_session' };
  }

  const sessionInvalidationReason = await readSessionInvalidationReason(session, diagnostics);
  if (sessionInvalidationReason) {
    const deleteSessionStartedAt = performance.now();
    await deleteSession(sessionId);
    diagnostics.deleteSessionMs = performance.now() - deleteSessionStartedAt;
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: sessionInvalidationReason,
      session,
      startedAt,
    });
    return { kind: 'invalid', reason: sessionInvalidationReason };
  }

  if (!shouldRefreshSession(session.expiresAt)) {
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
    const result = {
      kind: 'authenticated',
      user,
      expiresAt: session.expiresAt,
      freshReauthAt: session.freshReauthAt,
      ...(session.activeOrganizationId
        ? { activeOrganizationId: session.activeOrganizationId }
        : {}),
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'authenticated',
      session,
      startedAt,
    });
    return result;
  }

  const fullSessionReadStartedAt = performance.now();
  const refreshableSession = await getSession(sessionId, { decryptTokens: true });
  diagnostics.refreshSessionReadMs = performance.now() - fullSessionReadStartedAt;
  if (!refreshableSession) {
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'invalid_session',
      session,
      startedAt,
    });
    return { kind: 'invalid', reason: 'invalid_session' };
  }

  if (!refreshableSession.refreshToken) {
    if (refreshableSession.expiresAt && refreshableSession.expiresAt < Date.now()) {
      const deleteSessionStartedAt = performance.now();
      await deleteSession(sessionId);
      diagnostics.deleteSessionMs = performance.now() - deleteSessionStartedAt;
      logSessionResolutionTimingIfEnabled({
        diagnostics,
        reason: 'session_expired',
        session: refreshableSession,
        startedAt,
      });
      return { kind: 'invalid', reason: 'session_expired' };
    }
    const hydrateStartedAt = performance.now();
    const user = await hydrateSessionUserFromAccessToken(sessionId, refreshableSession);
    diagnostics.hydrateUserMs = performance.now() - hydrateStartedAt;
    const result = {
      kind: 'authenticated',
      user,
      expiresAt: refreshableSession.expiresAt,
      freshReauthAt: refreshableSession.freshReauthAt,
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'authenticated',
      session: refreshableSession,
      startedAt,
    });
    return result;
  }

  try {
    logger.debug('Refreshing access token for session', {
      operation: 'token_refresh',
      has_refresh_token: true,
      ...buildLogContext(session.auth),
    });

    const refreshStartedAt = performance.now();
    await refreshSession(sessionId, refreshableSession);
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

    const result = {
      kind: 'authenticated',
      user: updatedSession?.user ?? null,
      expiresAt: updatedSession?.expiresAt,
      freshReauthAt: updatedSession?.freshReauthAt,
      ...(updatedSession?.activeOrganizationId
        ? { activeOrganizationId: updatedSession.activeOrganizationId }
        : {}),
    } satisfies Extract<SessionResolutionResult, { kind: 'authenticated' }>;
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: 'authenticated',
      session: updatedSession ?? refreshableSession,
      startedAt,
    });
    return result;
  } catch (error) {
    const result = await handleRefreshFailure({
      error,
      sessionId,
      refreshToken: refreshableSession.refreshToken,
      expiresAt: refreshableSession.expiresAt,
      freshReauthAt: refreshableSession.freshReauthAt,
      scope: refreshableSession.auth,
      fallbackUser: refreshableSession.user ?? null,
    });
    logSessionResolutionTimingIfEnabled({
      diagnostics,
      reason: result.kind === 'invalid' ? result.reason : 'authenticated',
      session: refreshableSession,
      startedAt,
    });
    return result;
  }
};

export const getSessionUser = async (sessionId: string) => {
  const result = await resolveSessionUser(sessionId);
  return result.kind === 'authenticated' ? result.user : null;
};
