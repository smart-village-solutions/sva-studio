import {
  deleteSession,
  getSessionControlState,
  listUserSessionIds,
  setSessionControlState,
} from './redis-session.js';

export type SessionRevocationReason =
  | 'account_lifecycle_blocked'
  | 'dsr_deletion_requested'
  | 'user_bulk_deactivated'
  | 'user_deactivated'
  | 'user_status_inactivated';

type BlockingSessionRevocationReason = Extract<
  SessionRevocationReason,
  'account_lifecycle_blocked' | 'dsr_deletion_requested' | 'user_status_inactivated'
>;

const shouldPersistSessionControlState = (reason: SessionRevocationReason): boolean =>
  reason === 'account_lifecycle_blocked' ||
  reason === 'dsr_deletion_requested' ||
  reason === 'user_bulk_deactivated' ||
  reason === 'user_deactivated' ||
  reason === 'user_status_inactivated';

const toBlockingSessionRevocationReason = (
  reason: SessionRevocationReason
): BlockingSessionRevocationReason | null => {
  switch (reason) {
    case 'account_lifecycle_blocked':
    case 'dsr_deletion_requested':
    case 'user_status_inactivated':
      return reason;
    default:
      return null;
  }
};

export const revokeUserSessions = async (input: {
  readonly keycloakSubject: string;
  readonly reason: SessionRevocationReason;
}): Promise<void> => {
  const currentState = await getSessionControlState(input.keycloakSubject);
  const blockingReason = toBlockingSessionRevocationReason(input.reason);
  const nextState = {
    minimumSessionVersion: Math.max(currentState?.minimumSessionVersion ?? 1, 1) + 1,
    forcedReauthAt: Date.now(),
    ...(blockingReason
      ? {
          loginBlocked: true,
          loginBlockedReason: blockingReason,
        }
      : {}),
  };

  await setSessionControlState(
    input.keycloakSubject,
    nextState,
    shouldPersistSessionControlState(input.reason) ? null : undefined
  );

  const sessionIds = await listUserSessionIds(input.keycloakSubject);
  await Promise.all(sessionIds.map(async (sessionId) => deleteSession(sessionId)));
};

export const clearUserSessionLoginBlock = async (keycloakSubject: string): Promise<void> => {
  const currentState = await getSessionControlState(keycloakSubject);
  if (!currentState || currentState.loginBlockedReason !== 'user_status_inactivated') {
    return;
  }

  await setSessionControlState(
    keycloakSubject,
    {
      minimumSessionVersion: currentState.minimumSessionVersion,
      ...(typeof currentState.forcedReauthAt === 'number'
        ? { forcedReauthAt: currentState.forcedReauthAt }
        : {}),
    },
    null
  );
};
