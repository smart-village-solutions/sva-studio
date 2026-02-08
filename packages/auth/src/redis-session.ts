import type { RedisClientType } from 'redis';

export interface SessionData {
  userId: string;
  workspaceId: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const SESSION_KEY_PREFIX = 'session:';

/**
 * Create and persist a session in Redis
 * @param redis Redis client instance
 * @param sessionData Session data to store
 * @returns sessionId
 */
export const createSessionInRedis = async (
  redis: RedisClientType,
  sessionData: SessionData
): Promise<string> => {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const sessionId = generateSessionId();
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;

  try {
    await redis.setEx(key, SESSION_TTL, JSON.stringify(sessionData));
    return sessionId;
  } catch (error) {
    throw new Error(`Failed to create session in Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Retrieve session from Redis
 * @param redis Redis client instance
 * @param sessionId Session ID
 * @returns SessionData or null if not found/expired
 */
export const getSessionFromRedis = async (
  redis: RedisClientType,
  sessionId: string
): Promise<SessionData | null> => {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const key = `${SESSION_KEY_PREFIX}${sessionId}`;

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as SessionData;
  } catch (error) {
    throw new Error(`Failed to retrieve session from Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Delete session from Redis
 * @param redis Redis client instance
 * @param sessionId Session ID
 */
export const deleteSessionFromRedis = async (
  redis: RedisClientType,
  sessionId: string
): Promise<void> => {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const key = `${SESSION_KEY_PREFIX}${sessionId}`;

  try {
    await redis.del(key);
  } catch (error) {
    throw new Error(`Failed to delete session from Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Extend session TTL (refresh session)
 * @param redis Redis client instance
 * @param sessionId Session ID
 * @returns true if session was refreshed, false if not found
 */
export const refreshSessionInRedis = async (
  redis: RedisClientType,
  sessionId: string
): Promise<boolean> => {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const key = `${SESSION_KEY_PREFIX}${sessionId}`;

  try {
    const result = await redis.expire(key, SESSION_TTL);
    return result === 1; // Redis returns 1 if timeout was set, 0 if key doesn't exist
  } catch (error) {
    throw new Error(`Failed to refresh session in Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Generate a cryptographically secure session ID
 * @returns 32-character hex string
 */
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate session data structure
 * @param data Session data to validate
 * @returns true if valid, false otherwise
 */
export const isValidSessionData = (data: unknown): data is SessionData => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.userId === 'string' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.expiresAt === 'number'
  );
};
