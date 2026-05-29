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

  it('increments session control state, blocks new sessions and deletes all indexed sessions for deactivated users', async () => {
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
        loginBlocked: true,
        loginBlockedReason: 'user_deactivated',
      },
      null
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
        loginBlocked: true,
        loginBlockedReason: 'account_lifecycle_blocked',
      },
      null
    );
  });

  it('preserves an existing persistent login block when a later reactivatable revocation runs', async () => {
    revocationMocks.getSessionControlState.mockResolvedValue({
      minimumSessionVersion: 7,
      forcedReauthAt: 1_716_999_999_000,
      loginBlocked: true,
      loginBlockedReason: 'account_lifecycle_blocked',
    });
    const { revokeUserSessions } = await import('./session-revocation.js');

    await revokeUserSessions({
      keycloakSubject: 'kc-user-2',
      reason: 'user_deactivated',
    });

    expect(revocationMocks.setSessionControlState).toHaveBeenCalledWith(
      'kc-user-2',
      {
        minimumSessionVersion: 8,
        forcedReauthAt: 1_717_000_000_000,
        loginBlocked: true,
        loginBlockedReason: 'account_lifecycle_blocked',
      },
      null
    );
  });

  it('clears reactivatable login blocks when a user becomes active again', async () => {
    revocationMocks.getSessionControlState.mockResolvedValue({
      minimumSessionVersion: 5,
      forcedReauthAt: 1_716_999_999_000,
      loginBlocked: true,
      loginBlockedReason: 'user_status_inactivated',
    });

    const { clearUserSessionLoginBlock } = await import('./session-revocation.js');

    await clearUserSessionLoginBlock('kc-user-3');

    expect(revocationMocks.setSessionControlState).toHaveBeenCalledWith(
      'kc-user-3',
      {
        minimumSessionVersion: 5,
        forcedReauthAt: 1_716_999_999_000,
      },
      null
    );
  });

  it('clears user deactivation login blocks when a user becomes active again', async () => {
    revocationMocks.getSessionControlState.mockResolvedValue({
      minimumSessionVersion: 5,
      forcedReauthAt: 1_716_999_999_000,
      loginBlocked: true,
      loginBlockedReason: 'user_deactivated',
    });

    const { clearUserSessionLoginBlock } = await import('./session-revocation.js');

    await clearUserSessionLoginBlock('kc-user-4');

    expect(revocationMocks.setSessionControlState).toHaveBeenCalledWith(
      'kc-user-4',
      {
        minimumSessionVersion: 5,
        forcedReauthAt: 1_716_999_999_000,
      },
      null
    );
  });
});
