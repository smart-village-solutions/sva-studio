import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
  },
  jitProvisionAccount: vi.fn(),
  withInstanceDb: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

vi.mock('../jit-provisioning.js', () => ({
  jitProvisionAccount: mocks.jitProvisionAccount,
}));

vi.mock('../db.js', () => ({
  withInstanceDb: mocks.withInstanceDb,
}));

vi.mock('../iam-account-management/shared-activity.js', () => ({
  notifyPermissionInvalidation: mocks.notifyPermissionInvalidation,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ trace_id: 'trace-test' })),
}));

describe('runPostLoginTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jitProvisionAccount.mockResolvedValue(undefined);
    mocks.notifyPermissionInvalidation.mockResolvedValue(undefined);
    mocks.withInstanceDb.mockImplementation(async (_instanceId, work) => work({ query: vi.fn() }));
  });

  it('runs jit provisioning and invalidates permission snapshots for instance users', async () => {
    const { runPostLoginTasks } = await import('./post-login-tasks.js');

    await runPostLoginTasks('de-test', 'kc-user-1');

    expect(mocks.jitProvisionAccount).toHaveBeenCalledWith({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
    });
    expect(mocks.withInstanceDb).toHaveBeenCalledWith('de-test', expect.any(Function));
    expect(mocks.notifyPermissionInvalidation).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.any(Function) }),
      {
        instanceId: 'de-test',
        keycloakSubject: 'kc-user-1',
        trigger: 'user_login',
      }
    );
  });

  it('skips permission invalidation when the session has no instance context', async () => {
    const { runPostLoginTasks } = await import('./post-login-tasks.js');

    await runPostLoginTasks(undefined, 'kc-user-1');

    expect(mocks.jitProvisionAccount).toHaveBeenCalledWith({
      instanceId: undefined,
      keycloakSubject: 'kc-user-1',
    });
    expect(mocks.withInstanceDb).not.toHaveBeenCalled();
    expect(mocks.notifyPermissionInvalidation).not.toHaveBeenCalled();
  });

  it('logs and swallows jit provisioning failures before continuing with invalidation', async () => {
    const { runPostLoginTasks } = await import('./post-login-tasks.js');

    mocks.jitProvisionAccount.mockRejectedValueOnce(new Error('jit unavailable'));

    await runPostLoginTasks('de-test', 'kc-user-1');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'JIT provisioning failed after callback',
      expect.objectContaining({
        operation: 'jit_provision',
        user_id: 'kc-user-1',
        instance_id: 'de-test',
        error: 'jit unavailable',
      })
    );
    expect(mocks.withInstanceDb).toHaveBeenCalledWith('de-test', expect.any(Function));
  });
});
