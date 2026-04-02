import { createSdkLogger } from '@sva/sdk/server';

import { deleteSession, getSessionControlState, listUserSessionIds, setSessionControlState } from '../redis-session.server.js';
import { emitAuthAuditEvent } from '../audit-events.server.js';
import type { ForceReauthInput, SessionControlState } from '../types.js';
import { buildLogContext } from '../shared/log-context.js';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const buildNextSessionControlState = (
  current: SessionControlState | undefined,
  forcedReauthAt: number
): SessionControlState => ({
  minimumSessionVersion: Math.max(current?.minimumSessionVersion ?? 0, 0) + 1,
  forcedReauthAt,
});

export const forceReauthUser = async (input: ForceReauthInput): Promise<void> => {
  const forcedReauthAt = Date.now();
  const currentState = await getSessionControlState(input.userId);
  const nextState = buildNextSessionControlState(currentState, forcedReauthAt);

  await setSessionControlState(input.userId, nextState);

  const sessionIds = await listUserSessionIds(input.userId);
  await Promise.all(sessionIds.map(async (sessionId) => deleteSession(sessionId)));

  if (input.mode === 'app_and_idp' && input.instanceId) {
    const identityProvider = await resolveIdentityProviderForInstance(input.instanceId);
    const logoutUser =
      identityProvider?.provider &&
      'logoutUser' in identityProvider.provider &&
      typeof identityProvider.provider.logoutUser === 'function'
        ? identityProvider.provider.logoutUser.bind(identityProvider.provider)
        : null;
    if (logoutUser) {
      await logoutUser(input.userId);
    }
  }

  logger.info('Forced reauth applied for user', {
    operation: 'forced_reauth',
    user_id: input.userId,
    reauth_mode: input.mode,
    sessions_revoked: sessionIds.length,
    reason: input.reason,
    ...buildLogContext(),
  });

  await emitAuthAuditEvent({
    eventType: 'forced_reauth',
    actorUserId: input.userId,
    outcome: 'success',
  });
};
