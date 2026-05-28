import { beforeEach, describe, expect, it, vi } from 'vitest';

const revocationMocks = vi.hoisted(() => ({
  deleteSession: vi.fn(async () => undefined),
  getSessionControlState: vi.fn(async () => undefined),
  listUserSessionIds: vi.fn(async () => ['session-a', 'session-b']),
  setSessionControlState: vi.fn(async () => undefined),
}));

vi.mock('./redis-session.js', () => ({
  deleteSession: revocationMocks.deleteSession,
  getSessionControlState: revocationMocks.getSessionControlState,
  listUserSessionIds: revocationMocks.listUserSessionIds,
  setSessionControlState: revocationMocks.setSessionControlState,
}));

describe('session-revocation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_717_000_000_000);
    revocationMocks.listUserSessionIds.mockResolvedValue(['session-a', 'session-b']);
    revocationMocks.getSessionControlState.mockResolvedValue(undefined);
  });

  it('increments session control state and deletes all indexed sessions for the user', async () => {
    const { revokeUserSessions } = await import('./session-revocation.js');

    await revokeUserSessions({
      keycloakSubject: 'kc-user-1',
      reason: 'user_deactivated',
    });

    expect(revocationMocks.setSessionControlState).toHaveBeenCalledWith(
      'kc-user-1',
      {
        minimumSessionVersion: 2,
        forcedReauthAt: 1_717_000_000_000,
      }
    );
    expect(revocationMocks.deleteSession).toHaveBeenCalledTimes(2);
    expect(revocationMocks.deleteSession).toHaveBeenNthCalledWith(1, 'session-a');
    expect(revocationMocks.deleteSession).toHaveBeenNthCalledWith(2, 'session-b');
  });

  it('preserves and advances existing control state on repeated revocations', async () => {
    revocationMocks.getSessionControlState.mockResolvedValue({
      minimumSessionVersion: 4,
      forcedReauthAt: 1_716_999_999_000,
    });
    const { revokeUserSessions } = await import('./session-revocation.js');

    await revokeUserSessions({
      keycloakSubject: 'kc-user-2',
      reason: 'account_lifecycle_blocked',
    });

    expect(revocationMocks.setSessionControlState).toHaveBeenCalledWith(
      'kc-user-2',
      {
        minimumSessionVersion: 5,
        forcedReauthAt: 1_717_000_000_000,
      }
    );
  });
});
