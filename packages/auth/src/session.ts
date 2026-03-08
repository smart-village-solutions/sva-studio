import type { LoginState, Session } from './types';

const loginStates = new Map<string, LoginState>();
const sessions = new Map<string, Session>();

/**
 * Store a login state entry by state token for later callback validation.
 */
export const createLoginState = (state: string, value: LoginState) => {
  loginStates.set(state, value);
};

/**
 * Returns and removes a login state entry by state token for one-time use.
 */
export const consumeLoginState = (state: string) => {
  const value = loginStates.get(state);
  if (value) {
    loginStates.delete(state);
  }
  return value ?? null;
};

/**
 * Store a new session record by its id.
 */
export const createSession = (session: Session) => {
  sessions.set(session.id, session);
};

/**
 * Returns the session for the given id, or null if missing.
 */
export const getSession = (sessionId: string) => {
  return sessions.get(sessionId) ?? null;
};

/**
 * Updates a session by id with partial fields and returns the new value when found.
 */
export const updateSession = (sessionId: string, update: Partial<Session>) => {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  const nextSession = { ...session, ...update } satisfies Session;
  sessions.set(sessionId, nextSession);
  return nextSession;
};

/**
 * Removes a session by id.
 */
export const deleteSession = (sessionId: string) => {
  sessions.delete(sessionId);
};

/**
 * Remove sessions whose age exceeds the TTL.
 */
export const clearExpiredSessions = (now: number, ttlMs: number) => {
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > ttlMs) {
      sessions.delete(id);
    }
  }
};

/**
 * Remove login states whose age exceeds the TTL.
 */
export const clearExpiredLoginStates = (now: number, ttlMs: number) => {
  for (const [state, loginState] of loginStates.entries()) {
    if (now - loginState.createdAt > ttlMs) {
      loginStates.delete(state);
    }
  }
};
