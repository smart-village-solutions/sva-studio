import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadMyProfileDetail: vi.fn(),
  updateMyProfileDetail: vi.fn(),
  createProfileCommands: vi.fn(() => ({
    loadMyProfileDetail: state.loadMyProfileDetail,
    updateMyProfileDetail: state.updateMyProfileDetail,
  })),
}));

vi.mock('@sva/iam-admin', () => ({
  createProfileCommands: state.createProfileCommands,
}));

vi.mock('../jit-provisioning.server.js', () => ({
  jitProvisionAccountWithClient: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  emitActivityLog: vi.fn(),
  logger: { warn: vi.fn() },
  resolveActorAccountId: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: vi.fn(),
}));

import { loadMyProfileDetail, updateMyProfileDetail } from './profile-commands.js';

describe('iam-account-management/profile-commands adapter', () => {
  it('exposes iam-admin profile commands through the auth boundary', () => {
    expect(state.createProfileCommands).toHaveBeenCalledWith(
      expect.objectContaining({
        emitActivityLog: expect.any(Function),
        jitProvisionAccountWithClient: expect.any(Function),
        logger: expect.any(Object),
        resolveActorAccountId: expect.any(Function),
        resolveUserDetail: expect.any(Function),
        withInstanceScopedDb: expect.any(Function),
      })
    );
    expect(loadMyProfileDetail).toBe(state.loadMyProfileDetail);
    expect(updateMyProfileDetail).toBe(state.updateMyProfileDetail);
  });
});
