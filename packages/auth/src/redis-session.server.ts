import { getRedisClient } from './redis.server.js';
import { encryptToken, decryptToken } from './crypto.server.js';
import { getAuthConfig } from './config.js';
import { emitAuthAuditEvent } from './audit-events.server.js';
import { metrics } from '@opentelemetry/api';
import {
  clearExpiredLoginStates as clearExpiredInMemoryLoginStates,
  clearExpiredSessions as clearExpiredInMemorySessions,
  consumeLoginState as consumeInMemoryLoginState,
  createLoginState as createInMemoryLoginState,
  createSession as createInMemorySession,
  deleteSession as deleteInMemorySession,
  getSession as getInMemorySession,
  updateSession as updateInMemorySession,
} from './session.js';
import type { Session, SessionControlState } from './types.js';
import { createSdkLogger } from '@sva/sdk/server';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const meter = metrics.getMeter('sva.auth.sessions');
const sessionOperationsCounter = meter.createCounter('session_operations_total', {
  description: 'Session and login-state operations grouped by operation and result.',
});
const sessionOperationDurationHistogram = meter.createHistogram('session_operation_duration_seconds', {
  description: 'Duration of session and login-state operations.',
  unit: 's',
});

const resolveDefaultTestPrefix = (): string => {
  if (process.env.NODE_ENV !== 'test') {
    return '';
  }

  const workerId = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID;
  return workerId ? `vitest:${workerId}:` : 'vitest:default:';
};

const resolveKeyPrefix = (): string =>
  process.env.SVA_AUTH_REDIS_KEY_PREFIX ?? resolveDefaultTestPrefix();

const sessionPrefix = () => `${resolveKeyPrefix()}session:`;
const loginStatePrefix = () => `${resolveKeyPrefix()}login_state:`;
const sessionControlPrefix = () => `${resolveKeyPrefix()}session_control:`;
const userSessionIndexPrefix = () => `${resolveKeyPrefix()}user_sessions:`;

const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const DEFAULT_LOGIN_STATE_TTL = 60 * 10; // 10 minutes in seconds
const DEFAULT_SESSION_CONTROL_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

const inMemorySessionControl = new Map<string, SessionControlState>();
const inMemoryUserSessions = new Map<string, Set<string>>();

const shouldUseInMemorySessionFallback = (): boolean =>
  process.env.SVA_RUNTIME_PROFILE === 'acceptance-hb' &&
  process.env.SVA_AUTH_ALLOW_IN_MEMORY_SESSION_FALLBACK !== 'false';

const runWithSessionFallback = async <T>(input: {
  operation: string;
  redis: () => Promise<T>;
  fallback: () => T | Promise<T>;
}): Promise<T> => {
  try {
    return await input.redis();
  } catch (error) {
    if (!shouldUseInMemorySessionFallback()) {
      throw error;
    }

    logger.warn('Redis session store unavailable, using in-memory fallback', {
      operation: input.operation,
      runtime_profile: process.env.SVA_RUNTIME_PROFILE ?? 'unknown',
      error: error instanceof Error ? error.message : String(error),
      fallback: 'in-memory-session-store',
    });

    return await input.fallback();
  }
};

const trackSessionOperation = async <T>(operation: string, work: () => Promise<T>): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await work();
    sessionOperationsCounter.add(1, { operation, status: 'success' });
    sessionOperationDurationHistogram.record((Date.now() - startedAt) / 1000, { operation });
    return result;
  } catch (error) {
    sessionOperationsCounter.add(1, { operation, status: 'error' });
    sessionOperationDurationHistogram.record((Date.now() - startedAt) / 1000, { operation });
    throw error;
  }
};

/**
 * Get encryption key from environment
 */
const getEncryptionKey = (): string => {
  return process.env.ENCRYPTION_KEY || '';
};

const resolveSessionRedisTtlSeconds = (session: Session): number => {
  let sessionRedisTtlBufferMs = 5 * 60 * 1000;
  let sessionTtlMs = DEFAULT_SESSION_TTL * 1000;

  try {
    const config = getAuthConfig();
    sessionRedisTtlBufferMs = config.sessionRedisTtlBufferMs;
    sessionTtlMs = config.sessionTtlMs;
  } catch {
    // Keep defaults for low-level session store tests that do not configure auth env.
  }

  if (typeof session.expiresAt !== 'number') {
    return Math.max(1, Math.ceil((sessionTtlMs + sessionRedisTtlBufferMs) / 1000));
  }

  const ttlMs = session.expiresAt - Date.now() + sessionRedisTtlBufferMs;
  return Math.max(1, Math.ceil(ttlMs / 1000));
};

const addInMemoryUserSession = (userId: string, sessionId: string) => {
  const current = inMemoryUserSessions.get(userId) ?? new Set<string>();
  current.add(sessionId);
  inMemoryUserSessions.set(userId, current);
};

const removeInMemoryUserSession = (userId: string, sessionId: string) => {
  const current = inMemoryUserSessions.get(userId);
  if (!current) {
    return;
  }

  current.delete(sessionId);
  if (current.size === 0) {
    inMemoryUserSessions.delete(userId);
  }
};

const readStoredSessionForDeletion = async (sessionId: string): Promise<Session | undefined> => {
  const data = await runWithSessionFallback({
    operation: 'read_session_for_deletion',
    redis: async () => {
      const redis = getRedisClient();
      return redis.get(sessionPrefix() + sessionId);
    },
    fallback: () => {
      const session = getInMemorySession(sessionId);
      return session ? JSON.stringify(session) : null;
    },
  });

  if (!data) {
    return undefined;
  }

  return decryptSessionTokens(JSON.parse(data) as Session);
};

/**
 * Apply token encryption to session data if configured
 */
const encryptSessionTokens = (session: Session): Session => {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return session;

  return {
    ...session,
    accessToken: session.accessToken ? encryptToken(session.accessToken, encryptionKey) : undefined,
    refreshToken: session.refreshToken ? encryptToken(session.refreshToken, encryptionKey) : undefined,
    idToken: session.idToken ? encryptToken(session.idToken, encryptionKey) : undefined,
  };
};

/**
 * Decrypt session tokens if configured
 */
const decryptSessionTokens = (session: Session): Session => {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return session;

  try {
    return {
      ...session,
      accessToken: session.accessToken ? decryptToken(session.accessToken, encryptionKey) : undefined,
      refreshToken: session.refreshToken ? decryptToken(session.refreshToken, encryptionKey) : undefined,
      idToken: session.idToken ? decryptToken(session.idToken, encryptionKey) : undefined,
    };
  } catch (err) {
    logger.error('Session token decryption failed', {
      operation: 'decrypt_session',
      error: err instanceof Error ? err.message : String(err),
      fallback: 'return_encrypted',
    });
    // Return as-is if decryption fails (might be unencrypted legacy data)
    return session;
  }
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
    await runWithSessionFallback({
      operation: 'create_session',
      redis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.set(key, JSON.stringify(encryptedSession), 'EX', resolvedTtl);
        const userSessionKey = userSessionIndexPrefix() + session.userId;
        await redis.sadd(userSessionKey, sessionId);
        await redis.expire(userSessionKey, resolvedTtl);
      },
      fallback: () => {
        createInMemorySession(encryptedSession);
        addInMemoryUserSession(session.userId, sessionId);
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
      workspaceId: session.user?.instanceId,
      outcome: 'success',
    });
  });
}

/**
 * Get a session from Redis (tokens decrypted if ENCRYPTION_KEY set).
 */
export async function getSession(sessionId: string): Promise<Session | undefined> {
  return trackSessionOperation('get_session', async () => {
    const data = await runWithSessionFallback({
      operation: 'get_session',
      redis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        return redis.get(key);
      },
      fallback: () => {
        const session = getInMemorySession(sessionId);
        return session ? JSON.stringify(session) : null;
      },
    });

    if (!data) {
      logger.debug('Session not found', {
        operation: 'get_session',
        found: false,
      });
      return undefined;
    }

    let session = JSON.parse(data) as Session;
    session = decryptSessionTokens(session);

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
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
export async function updateSession(
  sessionId: string,
  updates: Partial<Session>
): Promise<void> {
  await trackSessionOperation('update_session', async () => {
    const currentSession = await getSession(sessionId);
    if (!currentSession) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession: Session = { ...currentSession, ...updates };
    const encryptedSession = encryptSessionTokens(updatedSession);
    const resolvedTtl = resolveSessionRedisTtlSeconds(updatedSession);
    const finalTtl = await runWithSessionFallback({
      operation: 'update_session',
      redis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.set(key, JSON.stringify(encryptedSession), 'EX', resolvedTtl);
        const userSessionKey = userSessionIndexPrefix() + updatedSession.userId;
        await redis.sadd(userSessionKey, sessionId);
        await redis.expire(userSessionKey, resolvedTtl);
        return resolvedTtl;
      },
      fallback: () => {
        const nextSession = updateInMemorySession(sessionId, encryptedSession);
        if (!nextSession) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        addInMemoryUserSession(updatedSession.userId, sessionId);
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
    await runWithSessionFallback({
      operation: 'delete_session',
      redis: async () => {
        const redis = getRedisClient();
        const key = sessionPrefix() + sessionId;
        await redis.del(key);
        if (existingSession?.userId) {
          await redis.srem(userSessionIndexPrefix() + existingSession.userId, sessionId);
        }
      },
      fallback: () => {
        deleteInMemorySession(sessionId);
        if (existingSession?.userId) {
          removeInMemoryUserSession(existingSession.userId, sessionId);
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
        workspaceId: existingSession.user?.instanceId,
        outcome: 'success',
      });
    }
  });
}

/**
 * Clear all expired sessions (manual cleanup - Redis TTL handles this automatically).
 * This is mainly for compatibility with the in-memory implementation.
 */
export async function clearExpiredSessions(): Promise<void> {
  if (shouldUseInMemorySessionFallback()) {
    clearExpiredInMemorySessions(Date.now(), DEFAULT_SESSION_TTL * 1000);
  }

  logger.debug('Expired sessions cleanup skipped', {
    operation: 'cleanup_sessions',
    reason: 'redis_ttl_handles_expiration',
  });
  // Redis automatically removes expired keys, so this is a no-op
}

/**
 * Store login state for OAuth PKCE flow.
 */
export async function createLoginState(
  state: string,
  data: {
    codeVerifier: string;
    nonce: string;
    createdAt: number;
    returnTo?: string;
    silent?: boolean;
    workspaceId?: string;
  }
): Promise<void> {
  await trackSessionOperation('create_login_state', async () => {
    await runWithSessionFallback({
      operation: 'create_login_state',
      redis: async () => {
        const redis = getRedisClient();
        const key = loginStatePrefix() + state;
        await redis.set(key, JSON.stringify(data), 'EX', DEFAULT_LOGIN_STATE_TTL);
      },
      fallback: () => {
        createInMemoryLoginState(state, data);
      },
    });

    logger.debug('Login state created', {
      operation: 'create_login_state',
      ttl_seconds: DEFAULT_LOGIN_STATE_TTL,
      has_return_to: !!data.returnTo,
    });

    await emitAuthAuditEvent({
      eventType: 'login_state_created',
      workspaceId: data.workspaceId,
      outcome: 'success',
    });
  });
}

/**
 * Consume login state (one-time use for security).
 */
export async function consumeLoginState(
  state: string
): Promise<{
  codeVerifier: string;
  nonce: string;
  createdAt: number;
  returnTo?: string;
  silent?: boolean;
  workspaceId?: string;
} | undefined> {
  return trackSessionOperation('consume_login_state', async () => {
    const data = await runWithSessionFallback({
      operation: 'consume_login_state',
      redis: async () => {
        const redis = getRedisClient();
        const key = loginStatePrefix() + state;
        const stored = await redis.get(key);
        if (stored) {
          await redis.del(key);
        }
        return stored;
      },
      fallback: () => {
        const stored = consumeInMemoryLoginState(state);
        return stored ? JSON.stringify(stored) : null;
      },
    });

    if (!data) {
      logger.debug('Login state not found', {
        operation: 'consume_login_state',
        found: false,
      });
      return undefined;
    }

    const result = JSON.parse(data) as {
      codeVerifier: string;
      nonce: string;
      createdAt: number;
      returnTo?: string;
      silent?: boolean;
      workspaceId?: string;
    };

    logger.debug('Login state consumed', {
      operation: 'consume_login_state',
      consumed: true,
      one_time_use: true,
    });
    await emitAuthAuditEvent({
      eventType: 'login_state_consumed',
      workspaceId: result.workspaceId,
      outcome: 'success',
    });
    return result;
  });
}

export async function getSessionControlState(userId: string): Promise<SessionControlState | undefined> {
  const data = await runWithSessionFallback({
    operation: 'get_session_control_state',
    redis: async () => {
      const redis = getRedisClient();
      return redis.get(sessionControlPrefix() + userId);
    },
    fallback: () => {
      const value = inMemorySessionControl.get(userId);
      return value ? JSON.stringify(value) : null;
    },
  });

  if (!data) {
    return undefined;
  }

  return JSON.parse(data) as SessionControlState;
}

export async function setSessionControlState(
  userId: string,
  state: SessionControlState,
  ttlSeconds: number = DEFAULT_SESSION_CONTROL_TTL
): Promise<void> {
  await runWithSessionFallback({
    operation: 'set_session_control_state',
    redis: async () => {
      const redis = getRedisClient();
      await redis.set(sessionControlPrefix() + userId, JSON.stringify(state), 'EX', ttlSeconds);
    },
    fallback: () => {
      inMemorySessionControl.set(userId, state);
    },
  });
}

export async function listUserSessionIds(userId: string): Promise<string[]> {
  return runWithSessionFallback({
    operation: 'list_user_sessions',
    redis: async () => {
      const redis = getRedisClient();
      return redis.smembers(userSessionIndexPrefix() + userId);
    },
    fallback: () => {
      return Array.from(inMemoryUserSessions.get(userId) ?? []);
    },
  });
}

/**
 * Get all session keys (for debugging/admin purposes).
 */
export async function getAllSessionKeys(): Promise<string[]> {
  return runWithSessionFallback({
    operation: 'get_all_session_keys',
    redis: async () => {
      const redis = getRedisClient();
      const prefix = sessionPrefix();
      const keys = await redis.keys(prefix + '*');
      return keys.map((key) => key.replace(prefix, ''));
    },
    fallback: () => {
      clearExpiredInMemoryLoginStates(Date.now(), DEFAULT_LOGIN_STATE_TTL * 1000);
      return [];
    },
  });
}

/**
 * Count active sessions.
 */
export async function getSessionCount(): Promise<number> {
  const redis = getRedisClient();
  const keys = await redis.keys(sessionPrefix() + '*');
  return keys.length;
}
