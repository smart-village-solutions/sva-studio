import { emitAuthAuditEvent } from './audit-events.js';
import { getRedisClient } from './redis.js';
import {
  DEFAULT_LOGIN_STATE_TTL,
  logger,
  loginStatePrefix,
  runWithRequiredRedisSessionStore,
  trackSessionOperation,
} from './redis-session-shared.js';
import { getRuntimeScopeRef, getWorkspaceIdForScope } from './scope.js';
import type { LoginState } from './types.js';

/**
 * Store login state for OAuth PKCE flow.
 */
export async function createLoginState(state: string, data: LoginState): Promise<void> {
  await trackSessionOperation('create_login_state', async () => {
    await runWithRequiredRedisSessionStore({
      operation: 'create_login_state',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = loginStatePrefix() + state;
        await redis.set(key, JSON.stringify(data), 'EX', DEFAULT_LOGIN_STATE_TTL);
      },
    });

    logger.debug('Login state created', {
      operation: 'create_login_state',
      ttl_seconds: DEFAULT_LOGIN_STATE_TTL,
      has_return_to: !!data.returnTo,
    });

    await emitAuthAuditEvent({
      eventType: 'login_state_created',
      scope: getRuntimeScopeRef(data),
      workspaceId: getWorkspaceIdForScope(getRuntimeScopeRef(data)),
      outcome: 'success',
    });
  });
}

/**
 * Consume login state (one-time use for security).
 */
export async function consumeLoginState(state: string): Promise<
  | {
      codeVerifier: string;
      nonce: string;
      createdAt: number;
      returnTo?: string;
      silent?: boolean;
      kind: 'platform' | 'instance';
      instanceId?: string;
    }
  | undefined
> {
  return trackSessionOperation('consume_login_state', async () => {
    const data = await runWithRequiredRedisSessionStore({
      operation: 'consume_login_state',
      runAgainstRedis: async () => {
        const redis = getRedisClient();
        const key = loginStatePrefix() + state;
        return redis.getdel(key);
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
      kind: 'platform' | 'instance';
      instanceId?: string;
    };

    logger.debug('Login state consumed', {
      operation: 'consume_login_state',
      consumed: true,
      one_time_use: true,
    });
    await emitAuthAuditEvent({
      eventType: 'login_state_consumed',
      scope: getRuntimeScopeRef(result),
      workspaceId: getWorkspaceIdForScope(getRuntimeScopeRef(result)),
      outcome: 'success',
    });
    return result;
  });
}
