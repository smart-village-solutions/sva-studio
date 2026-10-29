import { createSdkLogger } from '@sva/server-runtime';

import { isTokenErrorLike } from '../error-guards.js';
import { buildLogContext } from '../log-context.js';
import { deleteSession, getSession, getSessionControlState } from '../redis-session.js';
import {
  SessionNotFoundError,
  SessionStoreConflictError,
  SessionStoreUnavailableError,
  SessionTokenConflictError,
} from '../runtime-errors.js';
import type { Session, SessionUser } from '../types.js';
import {
  buildAuthenticatedSessionResult,
  logIncompleteSessionUser,
  logSessionResolutionTimingIfEnabled,
  type SessionResolutionFailureReason,
  type SessionResolutionResult,
  type SessionResolutionTimingDiagnostics,
} from './session-resolution.js';
import { refreshSession } from './session-refresh.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

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
    (typeof state.minimumSessionVersion === 'number' && sessionVersion < state.minimumSessionVersion) ||
    (typeof state.forcedReauthAt === 'number' && issuedAt < state.forcedReauthAt)
    ? 'forced_reauth'
    : null;
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
  if (input.error instanceof SessionStoreUnavailableError || input.error instanceof SessionStoreConflictError) {
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
  logger[tokenError ? 'warn' : 'error'](
    tokenError ? 'Token validation/refresh failed' : 'Token refresh failed',
    {
      operation: 'refresh_token',
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      ...(tokenError ? { has_refresh_token: Boolean(input.refreshToken) } : {}),
      session_expired: input.expiresAt ? input.expiresAt < now : false,
      reason_code: 'token_refresh_failed',
      ...buildLogContext(input.scope),
    }
  );
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
      session: updatedSession,
      startedAt,
    });
    return result;
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError || error instanceof SessionStoreConflictError) {
      throw error;
    }
    const currentSession = await getSession(sessionId, { decryptTokens: false });
    if (!currentSession) {
      const reason = session.expiresAt && session.expiresAt < Date.now()
        ? 'token_refresh_failed_after_expiry'
        : 'invalid_session';
      logSessionResolutionTimingIfEnabled({ diagnostics, reason, session, startedAt });
      return { kind: 'invalid', reason };
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
