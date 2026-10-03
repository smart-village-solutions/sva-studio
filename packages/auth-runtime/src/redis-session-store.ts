import { emitAuthAuditEvent } from './audit-events.js';
import { getRedisClient } from './redis.js';
import {
  logger,
  runWithRequiredRedisSessionStore,
  sessionPrefix,
  trackSessionOperation,
  userSessionIndexPrefix,
} from './redis-session-shared.js';
import {
  decryptSessionTokens,
  encryptSessionTokens,
  logGetSessionTimingIfEnabled,
  resolveSessionRedisTtlSeconds,
} from './redis-session-support.js';
import { getWorkspaceIdForScope } from './scope.js';
import type { Session } from './types.js';

export type GetSessionOptions = {
  readonly decryptTokens?: boolean;
};

const readStoredSessionForDeletion = async (sessionId: string): Promise<Session | undefined> => {
  const data = await runWithRequiredRedisSessionStore({
    operation: 'read_session_for_deletion',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      return redis.get(sessionPrefix() + sessionId);
    },
  });

  if (!data) {
    return undefined;
  }

  return decryptSessionTokens(JSON.parse(data) as Session);
};

/**
 * Create a new session in Redis with TTL (tokens encrypted if ENCRYPTION_KEY set).
 */
export async function createSession(
  sessionId: string,
  session: Session,
  ttl?: number
): Promise<void> {
  await trackSessionOperation('create_session', async () => {
    const encryptedSession = encryptSessionTokens(session);
    const resolvedTtl = ttl ?? resolveSessionRedisTtlSeconds(session);
    await runWithRequiredRedisSessionStore({
      operation: 'create_session',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.set(key, JSON.stringify(encryptedSession), 'EX', resolvedTtl);
        const userSessionKey = userSessionIndexPrefix() + session.userId;
        await redis.sadd(userSessionKey, sessionId);
        await redis.expire(userSessionKey, resolvedTtl);
      },
    });

    logger.debug('Session created', {
      operation: 'create_session',
      ttl_seconds: resolvedTtl,
      has_access_token: !!session.accessToken,
      has_refresh_token: !!session.refreshToken,
    });

    await emitAuthAuditEvent({
      eventType: 'session_created',
      actorUserId: session.user?.id ?? session.userId,
      scope: session.auth,
      workspaceId: getWorkspaceIdForScope(session.auth),
      outcome: 'success',
    });
  });
}

/**
 * Get a session from Redis (tokens decrypted if ENCRYPTION_KEY set).
 */
export async function getSession(
  sessionId: string,
  options: GetSessionOptions = {}
): Promise<Session | undefined> {
  return trackSessionOperation('get_session', async () => {
    const shouldDecryptTokens = options.decryptTokens ?? true;
    const startedAt = performance.now();
    let redisGetMs = 0;
    const data = await runWithRequiredRedisSessionStore({
      operation: 'get_session',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        const redisGetStartedAt = performance.now();
        const value = await redis.get(key);
        redisGetMs = performance.now() - redisGetStartedAt;
        return value;
      },
    });

    if (!data) {
      logGetSessionTimingIfEnabled({
        diagnostics: {
          decryptMs: 0,
          expiryCheckMs: 0,
          jsonParseMs: 0,
          redisGetMs,
          totalMs: performance.now() - startedAt,
        },
        found: false,
      });
      logger.debug('Session not found', {
        operation: 'get_session',
        found: false,
      });
      return undefined;
    }

    const jsonParseStartedAt = performance.now();
    let session = JSON.parse(data) as Session;
    const jsonParseMs = performance.now() - jsonParseStartedAt;
    const decryptStartedAt = performance.now();
    if (shouldDecryptTokens) {
      session = decryptSessionTokens(session);
    }
    const decryptMs = performance.now() - decryptStartedAt;

    const expiryCheckStartedAt = performance.now();
    const isExpired = Boolean(session.expiresAt && new Date(session.expiresAt) < new Date());
    const expiryCheckMs = performance.now() - expiryCheckStartedAt;
    logGetSessionTimingIfEnabled({
      diagnostics: {
        decryptMs,
        expiryCheckMs,
        jsonParseMs,
        redisGetMs,
        totalMs: performance.now() - startedAt,
      },
      found: true,
      session,
    });
    if (isExpired) {
      logger.info('Session expired', {
        operation: 'get_session',
        expired: true,
        expires_at: session.expiresAt,
      });
      await deleteSession(sessionId);
      return undefined;
    }

    logger.debug('Session retrieved', {
      operation: 'get_session',
      found: true,
      has_user: !!session.user,
    });
    return session;
  });
}

/**
 * Update an existing session in Redis (preserves TTL, encrypts tokens).
 */
export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
  await trackSessionOperation('update_session', async () => {
    const currentSession = await getSession(sessionId);
    if (!currentSession) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession: Session = { ...currentSession, ...updates };
    const encryptedSession = encryptSessionTokens(updatedSession);
    const resolvedTtl = resolveSessionRedisTtlSeconds(updatedSession);
    const finalTtl = await runWithRequiredRedisSessionStore({
      operation: 'update_session',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.set(key, JSON.stringify(encryptedSession), 'EX', resolvedTtl);
        const userSessionKey = userSessionIndexPrefix() + updatedSession.userId;
        await redis.sadd(userSessionKey, sessionId);
        await redis.expire(userSessionKey, resolvedTtl);
        return resolvedTtl;
      },
    });

    logger.debug('Session updated', {
      operation: 'update_session',
      ttl_seconds: finalTtl,
      fields_updated: Object.keys(updates).length,
    });
  });
}

/**
 * Delete a session from Redis.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await trackSessionOperation('delete_session', async () => {
    const existingSession = await readStoredSessionForDeletion(sessionId);
    await runWithRequiredRedisSessionStore({
      operation: 'delete_session',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.del(key);
        if (existingSession?.userId) {
          await redis.srem(userSessionIndexPrefix() + existingSession.userId, sessionId);
        }
      },
    });

    logger.debug('Session deleted', {
      operation: 'delete_session',
    });

    if (existingSession?.userId) {
      await emitAuthAuditEvent({
        eventType: 'session_deleted',
        actorUserId: existingSession.user?.id ?? existingSession.userId,
        scope: existingSession.auth,
        workspaceId: getWorkspaceIdForScope(existingSession.auth),
        outcome: 'success',
      });
    }
  });
}

/**
 * Clear all expired sessions. Redis TTL remains the runtime source of truth, so
 * this is intentionally a no-op outside low-level in-memory tests.
 */
export async function clearExpiredSessions(): Promise<void> {
  logger.debug('Expired sessions cleanup skipped', {
    operation: 'cleanup_sessions',
    reason: 'redis_ttl_handles_expiration',
  });
  // Redis automatically removes expired keys, so this is a no-op
}

/**
 * Get all session keys (for debugging/admin purposes).
 */
export async function getAllSessionKeys(): Promise<string[]> {
  return runWithRequiredRedisSessionStore({
    operation: 'get_all_session_keys',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      const prefix = sessionPrefix();
      const keys = await redis.keys(prefix + '*');
      return keys.map((key) => key.replace(prefix, ''));
    },
  });
}

/**
 * Count active sessions.
 */
export async function getSessionCount(): Promise<number> {
  return runWithRequiredRedisSessionStore({
    operation: 'get_session_count',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      const keys = await redis.keys(sessionPrefix() + '*');
      return keys.length;
    },
  });
}
