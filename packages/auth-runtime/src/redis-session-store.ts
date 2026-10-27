import {
  SessionNotFoundError,
  SessionStoreConflictError,
  SessionTokenConflictError,
} from './runtime-errors.js';

import { emitAuthAuditEvent } from './audit-events.js';
import { getRedisClient } from './redis.js';
import {
  logger,
  runWithRequiredRedisSessionStore,
  sessionControlPrefix,
  sessionPrefix,
  trackSessionOperation,
  userSessionIndexPrefix,
} from './redis-session-shared.js';
import {
  decryptSessionTokens,
  encryptSessionTokens,
  logGetSessionTimingIfEnabled,
  requireSessionEncryptionKey,
  resolveSessionRedisTtlSeconds,
} from './redis-session-support.js';
import { getWorkspaceIdForScope } from './scope.js';
import type { Session } from './types.js';

export type GetSessionOptions = {
  readonly decryptTokens?: boolean;
};

export type SessionTokenSet = Pick<Session, 'accessToken' | 'refreshToken' | 'idToken'>;

export type UpdateSessionOptions = {
  readonly expectedTokenSet?: SessionTokenSet;
};

const MAX_SESSION_UPDATE_ATTEMPTS = 5;

const compareAndSetSessionScript = `-- update_session_compare_and_set
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
if current ~= ARGV[1] then return 0 end
local currentControl = redis.call('GET', KEYS[2]) or ''
if currentControl ~= ARGV[2] then return 0 end
local session = cjson.decode(current)
local expiresAt = tonumber(session.expiresAt)
if expiresAt then
  local now = redis.call('TIME')
  local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
  if expiresAt < nowMs then return -1 end
end
redis.call('SET', KEYS[1], ARGV[3], 'EX', tonumber(ARGV[4]))
redis.call('SADD', KEYS[3], ARGV[5])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[4]))
return 1`;

const deleteSessionIfUnchangedScript = `-- delete_session_if_unchanged
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local deleted = redis.call('DEL', KEYS[1])
if deleted == 1 then redis.call('SREM', KEYS[2], ARGV[2]) end
return deleted`;

const isSessionInvalidated = (session: Session, controlState?: string | null): boolean => {
  if (!controlState) {
    return false;
  }

  const state = JSON.parse(controlState) as {
    minimumSessionVersion?: number;
    forcedReauthAt?: number;
    loginBlocked?: boolean;
  };
  const sessionVersion = session.sessionVersion ?? 1;
  const issuedAt = session.issuedAt ?? session.createdAt;
  return (
    state.loginBlocked === true ||
    (typeof state.minimumSessionVersion === 'number' &&
      sessionVersion < state.minimumSessionVersion) ||
    (typeof state.forcedReauthAt === 'number' && issuedAt < state.forcedReauthAt)
  );
};

const tokenSetMatches = (session: Session, tokenSet: SessionTokenSet): boolean =>
  session.accessToken === tokenSet.accessToken &&
  session.refreshToken === tokenSet.refreshToken &&
  session.idToken === tokenSet.idToken;

const deleteSessionIfUnchanged = async (
  sessionId: string,
  expectedValue: string,
  userId: string
): Promise<void> => {
  await runWithRequiredRedisSessionStore({
    operation: 'delete_expired_session',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      await redis.eval(
        deleteSessionIfUnchangedScript,
        2,
        sessionPrefix() + sessionId,
        userSessionIndexPrefix() + userId,
        expectedValue,
        userId
      );
    },
  });
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

  return JSON.parse(data) as Session;
};

/**
 * Create a new session in Redis with TTL and encrypted tokens.
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
 * Get a session from Redis (tokens decrypted unless explicitly skipped).
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

    requireSessionEncryptionKey();

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
      await deleteSessionIfUnchanged(sessionId, data, session.userId);
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
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>,
  options: UpdateSessionOptions = {}
): Promise<void> {
  await trackSessionOperation('update_session', async () => {
    const redis = getRedisClient();
    const sessionKey = sessionPrefix() + sessionId;
    let result: number | undefined;
    for (let attempt = 0; attempt < MAX_SESSION_UPDATE_ATTEMPTS; attempt += 1) {
      const stored = await runWithRequiredRedisSessionStore({
        operation: 'read_session_for_update',
        runAgainstRedis: () => redis.get(sessionKey),
      });
      if (!stored) {
        throw new SessionNotFoundError();
      }

      const currentSession = decryptSessionTokens(JSON.parse(stored) as Session);
      if (currentSession.expiresAt && currentSession.expiresAt < Date.now()) {
        await deleteSessionIfUnchanged(sessionId, stored, currentSession.userId);
        throw new SessionNotFoundError();
      }

      const controlKey = sessionControlPrefix() + currentSession.userId;
      const controlState = await runWithRequiredRedisSessionStore({
        operation: 'read_session_control_for_update',
        runAgainstRedis: () => redis.get(controlKey),
      });
      if (isSessionInvalidated(currentSession, controlState)) {
        throw new SessionNotFoundError();
      }
      if (
        options.expectedTokenSet &&
        !tokenSetMatches(currentSession, options.expectedTokenSet)
      ) {
        throw new SessionTokenConflictError();
      }

      const updatedSession: Session = { ...currentSession, ...updates };
      const encryptedSession = encryptSessionTokens(updatedSession);
      const ttlSeconds = resolveSessionRedisTtlSeconds(updatedSession);
      const comparison = Number(
        await runWithRequiredRedisSessionStore({
          operation: 'compare_and_set_session',
          runAgainstRedis: () =>
            redis.eval(
              compareAndSetSessionScript,
              3,
              sessionKey,
              controlKey,
              userSessionIndexPrefix() + currentSession.userId,
              stored,
              controlState ?? '',
              JSON.stringify(encryptedSession),
              String(ttlSeconds),
              sessionId
            ),
        })
      );

      if (comparison === 1) {
        result = ttlSeconds;
        break;
      }
      if (comparison === -1) {
        throw new SessionNotFoundError();
      }
    }

    if (result === undefined) {
      throw new SessionStoreConflictError();
    }

    logger.debug('Session updated', {
      operation: 'update_session',
      ttl_seconds: result,
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
