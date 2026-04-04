import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  buildMainserverIdentityAttributesMock: vi.fn(),
  updateUserMock: vi.fn(),
  syncRolesMock: vi.fn(),
  trackKeycloakCallMock: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../mainserver-credentials.server.js', () => ({
  buildMainserverIdentityAttributes: state.buildMainserverIdentityAttributesMock,
}));

vi.mock('./shared.js', () => ({
  logger: { error: state.loggerErrorMock },
  resolveIdentityProvider: vi.fn(),
  trackKeycloakCall: state.trackKeycloakCallMock,
}));

import { buildIdentityAttributesForUserUpdate, compensateUserIdentityUpdate } from './user-update-identity.js';

describe('user-update-identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.buildMainserverIdentityAttributesMock.mockImplementation(() => ({ existing: ['value'] }));
  });

  it('builds displayName only when provided in the update payload', () => {
    expect(
      buildIdentityAttributesForUserUpdate({
        existingAttributes: { locale: ['de'] },
        payload: {
          displayName: 'Alice Example',
          mainserverUserApplicationId: 'app-id',
          mainserverUserApplicationSecret: 'app-secret',
        },
      } as never),
    ).toEqual({
      existing: ['value'],
      displayName: ['Alice Example'],
    });

    expect(
      buildIdentityAttributesForUserUpdate({
        existingAttributes: undefined,
        payload: {
          mainserverUserApplicationId: 'app-id',
          mainserverUserApplicationSecret: undefined,
        },
      } as never),
    ).toEqual({ existing: ['value'] });
  });

  it('restores identity and roles during compensation', async () => {
    await compensateUserIdentityUpdate({
      instanceId: 'de-musterhausen',
      requestId: 'req-user',
      traceId: 'trace-user',
      userId: 'user-1',
      plan: {
        existing: {
          keycloakSubject: 'kc-user-1',
          email: 'alice@example.org',
          firstName: 'Alice',
          lastName: 'Example',
          status: 'active',
        },
        previousRoleNames: ['editor', 'iam_admin'],
      },
      restoreIdentity: true,
      restoreRoles: true,
      restoreIdentityAttributes: { locale: ['de'] },
      identityProvider: {
        provider: {
          updateUser: state.updateUserMock.mockResolvedValue(undefined),
          syncRoles: state.syncRolesMock.mockResolvedValue(undefined),
        },
      },
    } as never);

    expect(state.updateUserMock).toHaveBeenCalledWith('kc-user-1', expect.objectContaining({ enabled: true }));
    expect(state.syncRolesMock).toHaveBeenCalledWith('kc-user-1', ['editor', 'iam_admin']);
  });

  it('logs compensation failures and skips role restoration when disabled', async () => {
    await compensateUserIdentityUpdate({
      instanceId: 'de-musterhausen',
      requestId: 'req-user',
      userId: 'user-1',
      plan: {
        existing: {
          keycloakSubject: 'kc-user-1',
          email: 'alice@example.org',
          firstName: 'Alice',
          lastName: 'Example',
          status: 'inactive',
        },
        previousRoleNames: ['editor'],
      },
      restoreIdentity: true,
      restoreRoles: false,
      restoreIdentityAttributes: { locale: ['de'] },
      identityProvider: {
        provider: {
          updateUser: state.updateUserMock.mockRejectedValue(new Error('update failed')),
          syncRoles: state.syncRolesMock,
        },
      },
    } as never);

    expect(state.loggerErrorMock).toHaveBeenCalledWith(
      'IAM user update compensation failed',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
      }),
    );
    expect(state.syncRolesMock).not.toHaveBeenCalled();
  });
});
