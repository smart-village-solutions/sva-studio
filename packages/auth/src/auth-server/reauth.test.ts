import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteSessionMock,
  getSessionControlStateMock,
  listUserSessionIdsMock,
  setSessionControlStateMock,
  logoutUserMock,
  emitAuthAuditEventMock,
} = vi.hoisted(() => ({
  deleteSessionMock: vi.fn(),
  getSessionControlStateMock: vi.fn(),
  listUserSessionIdsMock: vi.fn(),
  setSessionControlStateMock: vi.fn(),
  logoutUserMock: vi.fn(),
  emitAuthAuditEventMock: vi.fn(),
}));

vi.mock('../redis-session.server', () => ({
  deleteSession: deleteSessionMock,
  getSessionControlState: getSessionControlStateMock,
  listUserSessionIds: listUserSessionIdsMock,
  setSessionControlState: setSessionControlStateMock,
}));

vi.mock('../iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: vi.fn(async () => ({
    provider: {
      logoutUser: logoutUserMock,
    },
  })),
}));

vi.mock('../audit-events.server.js', () => ({
  emitAuthAuditEvent: emitAuthAuditEventMock,
}));

vi.mock('../shared/log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ workspace_id: 'default' })),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    info: vi.fn(),
  }),
}));

import { forceReauthUser } from './reauth.ts';

describe('auth-server/reauth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionControlStateMock.mockResolvedValue({ minimumSessionVersion: 1 });
    listUserSessionIdsMock.mockResolvedValue(['session-1', 'session-2']);
    deleteSessionMock.mockResolvedValue(undefined);
    setSessionControlStateMock.mockResolvedValue(undefined);
    logoutUserMock.mockResolvedValue(undefined);
    emitAuthAuditEventMock.mockResolvedValue(undefined);
  });

  it('revokes all app sessions and increments the minimum session version', async () => {
    await forceReauthUser({
      userId: 'user-1',
      mode: 'app_only',
      reason: 'role_change',
    });

    expect(setSessionControlStateMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        minimumSessionVersion: 2,
      })
    );
    expect(deleteSessionMock).toHaveBeenCalledTimes(2);
    expect(logoutUserMock).not.toHaveBeenCalled();
    expect(emitAuthAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'forced_reauth',
        actorUserId: 'user-1',
      })
    );
  });

  it('logs the user out of Keycloak when app_and_idp is requested', async () => {
    await forceReauthUser({
      userId: 'user-2',
      mode: 'app_and_idp',
      reason: 'security_incident',
      instanceId: 'demo',
    });

    expect(logoutUserMock).toHaveBeenCalledWith('user-2');
  });
});
