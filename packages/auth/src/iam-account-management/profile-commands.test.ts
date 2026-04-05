import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  existingAccountId: 'account-1' as string | null,
  provisionedAccountId: 'provisioned-account-1',
  queryMock: vi.fn(async () => ({ rowCount: 1, rows: [] })),
  resolveUserDetailMock: vi.fn(async () => ({
    id: 'account-1',
    username: 'seeded-user',
  })),
  protectFieldMock: vi.fn((value: string) => `enc:${value}`),
  loggerWarnMock: vi.fn(),
}));

vi.mock('../jit-provisioning.server.js', () => ({
  jitProvisionAccountWithClient: vi.fn(async () => ({
    accountId: state.provisionedAccountId,
  })),
}));

vi.mock('./encryption.js', () => ({
  protectField: state.protectFieldMock,
}));

vi.mock('./shared.js', () => ({
  emitActivityLog: vi.fn(),
  logger: {
    warn: state.loggerWarnMock,
  },
  resolveActorAccountId: vi.fn(async () => state.existingAccountId),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: unknown) => Promise<unknown>) =>
    work({ query: state.queryMock })
  ),
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: state.resolveUserDetailMock,
}));

import { loadMyProfileDetail } from './profile-commands.js';

describe('iam-account-management/profile-commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.existingAccountId = 'account-1';
    state.provisionedAccountId = 'provisioned-account-1';
    state.queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    state.resolveUserDetailMock.mockResolvedValue({
      id: 'account-1',
      username: 'seeded-user',
    });
    state.protectFieldMock.mockImplementation((value: string) => `enc:${value}`);
  });

  it('seeds missing local profile fields from session claims before resolving the detail', async () => {
    await loadMyProfileDetail(
      {
        instanceId: 'de-musterhausen',
        requestId: 'req-profile',
        traceId: 'trace-profile',
      },
      'kc-1',
      {
        username: 'jane.doe',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane Doe',
      }
    );

    expect(state.queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE iam.accounts'),
      [
        'account-1',
        'de-musterhausen',
        'enc:jane.doe',
        'enc:jane@example.com',
        'enc:Jane',
        'enc:Doe',
        'enc:Jane Doe',
      ]
    );
    expect(state.resolveUserDetailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        userId: 'account-1',
      })
    );
  });

  it('continues profile loading and logs a sanitized warning when session seeding fails', async () => {
    state.queryMock.mockImplementationOnce(async () => ({ rowCount: 0, rows: [] }));
    state.queryMock.mockRejectedValueOnce(new Error('seed failed'));
    state.queryMock.mockImplementation(async () => ({ rowCount: 0, rows: [] }));

    const detail = await loadMyProfileDetail(
      {
        instanceId: 'de-musterhausen',
        requestId: 'req-profile',
        traceId: 'trace-profile',
      },
      'kc-1',
      {
        email: 'jane@example.com',
      }
    );

    expect(detail).toEqual({
      id: 'account-1',
      username: 'seeded-user',
    });
    expect(state.queryMock).toHaveBeenNthCalledWith(1, 'SAVEPOINT iam_profile_session_seed');
    expect(state.queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE iam.accounts'),
      [
        'account-1',
        'de-musterhausen',
        null,
        'enc:jane@example.com',
        null,
        null,
        null,
      ]
    );
    expect(state.queryMock).toHaveBeenNthCalledWith(3, 'ROLLBACK TO SAVEPOINT iam_profile_session_seed');
    expect(state.queryMock).toHaveBeenNthCalledWith(4, 'RELEASE SAVEPOINT iam_profile_session_seed');
    expect(state.loggerWarnMock).toHaveBeenCalledWith(
      'IAM profile session seed skipped after failure',
      expect.objectContaining({
        operation: 'get_my_profile',
        request_id: 'req-profile',
        trace_id: 'trace-profile',
        instance_id: 'de-musterhausen',
        session_profile_claims_present: true,
        error_name: 'Error',
      })
    );
    expect(state.loggerWarnMock.mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(state.resolveUserDetailMock).toHaveBeenCalledTimes(1);
  });
});
