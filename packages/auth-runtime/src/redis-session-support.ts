import { getAuthConfig } from './config.js';
import { decryptToken, encryptToken } from './crypto.js';
import { DEFAULT_SESSION_TTL, logger } from './redis-session-shared.js';
import type { Session } from './types.js';

type GetSessionTimingDiagnostics = {
  readonly decryptMs: number;
  readonly expiryCheckMs: number;
  readonly jsonParseMs: number;
  readonly redisGetMs: number;
  readonly totalMs: number;
};

const isAuthorizeTimingDebugEnabled = (): boolean =>
  process.env.IAM_DEBUG_AUTHORIZE_TIMINGS === 'true';

export const logGetSessionTimingIfEnabled = (input: {
  diagnostics: GetSessionTimingDiagnostics;
  found: boolean;
  session?: Session;
}): void => {
  if (!isAuthorizeTimingDebugEnabled()) {
    return;
  }

  logger.info('Redis session get timing diagnostics', {
    operation: 'redis_session_get_timing',
    found: input.found,
    redis_get_ms: Number(input.diagnostics.redisGetMs.toFixed(2)),
    json_parse_ms: Number(input.diagnostics.jsonParseMs.toFixed(2)),
    decrypt_ms: Number(input.diagnostics.decryptMs.toFixed(2)),
    expiry_check_ms: Number(input.diagnostics.expiryCheckMs.toFixed(2)),
    total_ms: Number(input.diagnostics.totalMs.toFixed(2)),
    has_access_token: Boolean(input.session?.accessToken),
    has_refresh_token: Boolean(input.session?.refreshToken),
    has_id_token: Boolean(input.session?.idToken),
    user_id: input.session?.userId ?? null,
    session_expires_at: input.session?.expiresAt ?? null,
  });
};

/**
 * Get encryption key from environment
 */
const getEncryptionKey = (): string => {
  return process.env.ENCRYPTION_KEY || '';
};

export const resolveSessionRedisTtlSeconds = (session: Session): number => {
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

/**
 * Apply token encryption to session data if configured
 */
export const encryptSessionTokens = (session: Session): Session => {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return session;

  return {
    ...session,
    accessToken: session.accessToken ? encryptToken(session.accessToken, encryptionKey) : undefined,
    refreshToken: session.refreshToken
      ? encryptToken(session.refreshToken, encryptionKey)
      : undefined,
    idToken: session.idToken ? encryptToken(session.idToken, encryptionKey) : undefined,
  };
};

/**
 * Decrypt session tokens if configured
 */
export const decryptSessionTokens = (session: Session): Session => {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return session;

  try {
    return {
      ...session,
      accessToken: session.accessToken
        ? decryptToken(session.accessToken, encryptionKey)
        : undefined,
      refreshToken: session.refreshToken
        ? decryptToken(session.refreshToken, encryptionKey)
        : undefined,
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
