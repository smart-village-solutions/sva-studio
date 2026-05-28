import {
  deleteSession,
  getSessionControlState,
  listUserSessionIds,
  setSessionControlState,
} from './redis-session.js';

export const revokeUserSessions = async (input: {
  readonly keycloakSubject: string;
  readonly reason: string;
}): Promise<void> => {
  void input.reason;
  const currentState = await getSessionControlState(input.keycloakSubject);
  const nextState = {
    minimumSessionVersion: Math.max(currentState?.minimumSessionVersion ?? 1, 1) + 1,
    forcedReauthAt: Date.now(),
  };

  await setSessionControlState(input.keycloakSubject, nextState);

  const sessionIds = await listUserSessionIds(input.keycloakSubject);
  await Promise.all(sessionIds.map(async (sessionId) => deleteSession(sessionId)));
};
