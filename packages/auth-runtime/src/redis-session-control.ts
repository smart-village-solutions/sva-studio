import { getRedisClient } from './redis.js';
import {
  DEFAULT_SESSION_CONTROL_TTL,
  runWithRequiredRedisSessionStore,
  sessionControlPrefix,
  userSessionIndexPrefix,
} from './redis-session-shared.js';
import type { SessionControlState } from './types.js';

export async function getSessionControlState(
  userId: string
): Promise<SessionControlState | undefined> {
  const data = await runWithRequiredRedisSessionStore({
    operation: 'get_session_control_state',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      return redis.get(sessionControlPrefix() + userId);
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
  ttlSeconds: number | null = DEFAULT_SESSION_CONTROL_TTL
): Promise<void> {
  await runWithRequiredRedisSessionStore({
    operation: 'set_session_control_state',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      if (ttlSeconds === null) {
        await redis.set(sessionControlPrefix() + userId, JSON.stringify(state));
        return;
      }
      await redis.set(sessionControlPrefix() + userId, JSON.stringify(state), 'EX', ttlSeconds);
    },
  });
}

export async function listUserSessionIds(userId: string): Promise<string[]> {
  return runWithRequiredRedisSessionStore({
    operation: 'list_user_sessions',
    runAgainstRedis: async () => {
      const redis = getRedisClient();
      return redis.smembers(userSessionIndexPrefix() + userId);
    },
  });
}
