import type { Session } from '../types.js';

import {
  deleteSession,
  getSession,
  getSessionControlState,
} from '../redis-session.js';
import {
  createSessionResolutionTimingDiagnostics,
  logSessionResolutionTimingIfEnabled,
  refreshAndResolveSession,
  resolveCurrentSessionUser,
  resolveSessionWithoutRefreshToken,
  shouldRefreshSession,
  type SessionResolutionResult,
  type SessionResolutionTimingDiagnostics,
} from './session-resolution.js';

export type {
  SessionResolutionFailureReason,
  SessionResolutionResult,
} from './session-resolution.js';

const SESSION_CONTROL_ABSENT_CACHE_TTL_MS = 5_000;

const absentSessionControlCache = new Map<string, { readonly expiresAtMs: number }>();

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
    return resolveCurrentSessionUser(sessionId, session, diagnostics, startedAt);
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
    return resolveSessionWithoutRefreshToken(sessionId, refreshableSession, diagnostics, startedAt);
  }

  return refreshAndResolveSession(sessionId, refreshableSession, diagnostics, startedAt);
};

export const getSessionUser = async (sessionId: string) => {
  const result = await resolveSessionUser(sessionId);
  return result.kind === 'authenticated' ? result.user : null;
};
