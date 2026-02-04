import { getRedisClient } from './redis.server';
import type { Session } from './types';

const SESSION_PREFIX = 'session:';
const LOGIN_STATE_PREFIX = 'login_state:';
const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const DEFAULT_LOGIN_STATE_TTL = 60 * 10; // 10 minutes in seconds

/**
 * Create a new session in Redis with TTL.
 */
export async function createSession(
  sessionId: string,
  session: Session,
  ttl: number = DEFAULT_SESSION_TTL
): Promise<void> {
  const redis = getRedisClient();
  const key = SESSION_PREFIX + sessionId;

  await redis.set(key, JSON.stringify(session), 'EX', ttl);

  console.log(`[REDIS] Session created: ${sessionId} (TTL: ${ttl}s)`);
}

/**
 * Get a session from Redis.
 */
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const redis = getRedisClient();
  const key = SESSION_PREFIX + sessionId;

  const data = await redis.get(key);

  if (!data) {
    console.log(`[REDIS] Session not found: ${sessionId}`);
    return undefined;
  }

  const session = JSON.parse(data) as Session;

  // Check if session is expired
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    console.log(`[REDIS] Session expired: ${sessionId}`);
    await deleteSession(sessionId);
    return undefined;
  }

  console.log(`[REDIS] Session retrieved: ${sessionId}`);
  return session;
}

/**
 * Update an existing session in Redis (preserves TTL).
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>
): Promise<void> {
  const redis = getRedisClient();
  const key = SESSION_PREFIX + sessionId;

  // Get current session
  const currentSession = await getSession(sessionId);
  if (!currentSession) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Merge updates
  const updatedSession: Session = { ...currentSession, ...updates };

  // Get remaining TTL to preserve it
  const ttl = await redis.ttl(key);
  const finalTtl = ttl > 0 ? ttl : DEFAULT_SESSION_TTL;

  await redis.set(key, JSON.stringify(updatedSession), 'EX', finalTtl);

  console.log(`[REDIS] Session updated: ${sessionId} (TTL: ${finalTtl}s)`);
}

/**
 * Delete a session from Redis.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const key = SESSION_PREFIX + sessionId;

  await redis.del(key);

  console.log(`[REDIS] Session deleted: ${sessionId}`);
}

/**
 * Clear all expired sessions (manual cleanup - Redis TTL handles this automatically).
 * This is mainly for compatibility with the in-memory implementation.
 */
export async function clearExpiredSessions(): Promise<void> {
  console.log('[REDIS] TTL-based expiration active, manual cleanup not needed');
  // Redis automatically removes expired keys, so this is a no-op
}

/**
 * Store login state for OAuth PKCE flow.
 */
export async function createLoginState(
  state: string,
  data: { codeVerifier: string; nonce: string; createdAt: number; redirectTo?: string }
): Promise<void> {
  const redis = getRedisClient();
  const key = LOGIN_STATE_PREFIX + state;
  
  await redis.set(key, JSON.stringify(data), 'EX', DEFAULT_LOGIN_STATE_TTL);
  
  console.log(`[REDIS] Login state created: ${state} (TTL: ${DEFAULT_LOGIN_STATE_TTL}s)`);
}

/**
 * Consume login state (one-time use for security).
 */
export async function consumeLoginState(
  state: string
): Promise<{ codeVerifier: string; nonce: string; createdAt: number; redirectTo?: string } | undefined> {
  const redis = getRedisClient();
  const key = LOGIN_STATE_PREFIX + state;
  
  const data = await redis.get(key);
  
  if (!data) {
    console.log(`[REDIS] Login state not found: ${state}`);
    return undefined;
  }
  
  // Delete immediately (one-time use)
  await redis.del(key);
  
  const result = JSON.parse(data) as { codeVerifier: string; nonce: string; createdAt: number; redirectTo?: string };
  
  console.log(`[REDIS] Login state consumed: ${state}`);
  return result;
}

/**
 * Get all session keys (for debugging/admin purposes).
 */
export async function getAllSessionKeys(): Promise<string[]> {
  const redis = getRedisClient();
  const keys = await redis.keys(SESSION_PREFIX + '*');
  return keys.map((key) => key.replace(SESSION_PREFIX, ''));
}

/**
 * Count active sessions.
 */
export async function getSessionCount(): Promise<number> {
  const redis = getRedisClient();
  const keys = await redis.keys(SESSION_PREFIX + '*');
  return keys.length;
}
