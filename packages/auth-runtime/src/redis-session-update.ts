import {
  SessionNotFoundError,
  SessionStoreConflictError,
  SessionTokenConflictError,
} from './runtime-errors.js';
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
  resolveSessionRedisTtlSeconds,
} from './redis-session-support.js';
import type { Session } from './types.js';

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
  if (!controlState) return false;
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

export const deleteSessionIfUnchanged = async (
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
      if (!stored) throw new SessionNotFoundError();

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
      if (isSessionInvalidated(currentSession, controlState)) throw new SessionNotFoundError();
      if (options.expectedTokenSet && !tokenSetMatches(currentSession, options.expectedTokenSet)) {
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
      if (comparison === -1) throw new SessionNotFoundError();
    }

    if (result === undefined) throw new SessionStoreConflictError();
    logger.debug('Session updated', {
      operation: 'update_session',
      ttl_seconds: result,
      fields_updated: Object.keys(updates).length,
    });
  });
}
