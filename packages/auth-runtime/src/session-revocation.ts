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
  | 'account_lifecycle_blocked'
  | 'dsr_deletion_requested'
  | 'user_bulk_deactivated'
  | 'user_deactivated'
  | 'user_status_inactivated'
>;

type ReactivatableSessionRevocationReason = Extract<
  BlockingSessionRevocationReason,
  'user_bulk_deactivated' | 'user_deactivated' | 'user_status_inactivated'
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
    case 'user_bulk_deactivated':
    case 'user_deactivated':
    case 'user_status_inactivated':
      return reason;
    default:
      return null;
  }
};

const isPersistentLoginBlockReason = (
  reason: BlockingSessionRevocationReason | undefined
): reason is Exclude<BlockingSessionRevocationReason, ReactivatableSessionRevocationReason> =>
  reason === 'account_lifecycle_blocked' || reason === 'dsr_deletion_requested';

const isReactivatableLoginBlockReason = (
  reason: BlockingSessionRevocationReason | undefined
): reason is ReactivatableSessionRevocationReason =>
  reason === 'user_bulk_deactivated' || reason === 'user_deactivated' || reason === 'user_status_inactivated';

export const revokeUserSessions = async (input: {
  readonly keycloakSubject: string;
  readonly reason: SessionRevocationReason;
}): Promise<void> => {
  const currentState = await getSessionControlState(input.keycloakSubject);
  const blockingReason = toBlockingSessionRevocationReason(input.reason);
  const currentBlockingReason =
    currentState?.loginBlocked && currentState.loginBlockedReason ? currentState.loginBlockedReason : undefined;
  const nextBlockingReason = isPersistentLoginBlockReason(currentBlockingReason)
    ? currentBlockingReason
    : blockingReason ?? currentBlockingReason;
  const nextState = {
    minimumSessionVersion: Math.max(currentState?.minimumSessionVersion ?? 1, 1) + 1,
    forcedReauthAt: Date.now(),
    ...(nextBlockingReason
      ? {
          loginBlocked: true,
          loginBlockedReason: nextBlockingReason,
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
  if (!currentState || !isReactivatableLoginBlockReason(currentState.loginBlockedReason)) {
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
