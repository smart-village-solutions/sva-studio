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

const shouldPersistSessionControlState = (reason: SessionRevocationReason): boolean =>
  reason === 'account_lifecycle_blocked' ||
  reason === 'dsr_deletion_requested' ||
  reason === 'user_bulk_deactivated' ||
  reason === 'user_deactivated' ||
  reason === 'user_status_inactivated';

export const revokeUserSessions = async (input: {
  readonly keycloakSubject: string;
  readonly reason: SessionRevocationReason;
}): Promise<void> => {
  const currentState = await getSessionControlState(input.keycloakSubject);
  const nextState = {
    minimumSessionVersion: Math.max(currentState?.minimumSessionVersion ?? 1, 1) + 1,
    forcedReauthAt: Date.now(),
  };

  await setSessionControlState(
    input.keycloakSubject,
    nextState,
    shouldPersistSessionControlState(input.reason) ? null : undefined
  );

  const sessionIds = await listUserSessionIds(input.keycloakSubject);
  await Promise.all(sessionIds.map(async (sessionId) => deleteSession(sessionId)));
};
