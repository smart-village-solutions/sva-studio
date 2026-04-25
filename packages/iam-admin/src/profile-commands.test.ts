import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  protectField: (value: string) => `enc:${value}`,
}));

import { createProfileCommands } from './profile-commands.js';
import type { QueryClient } from './query-client.js';

const createDeps = () => {
  const client: QueryClient = {
    query: vi.fn(async () => ({ rowCount: 1, rows: [] })),
  };
  return {
    client,
    deps: {
      emitActivityLog: vi.fn(async () => undefined),
      jitProvisionAccountWithClient: vi.fn(async () => ({ accountId: 'provisioned-account-1' })),
      logger: {
        warn: vi.fn(),
      },
      resolveActorAccountId: vi.fn(async () => 'account-1'),
      resolveUserDetail: vi.fn(async () => ({
        id: 'account-1',
        username: 'seeded-user',
      })),
      withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
        work(client)
      ),
    },
  };
};

describe('profile-commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds missing local profile fields from session claims before resolving the detail', async () => {
    const { client, deps } = createDeps();
    const commands = createProfileCommands(deps);

    await commands.loadMyProfileDetail(
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

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE iam.accounts'), [
      'account-1',
      'de-musterhausen',
      'enc:jane.doe',
      'enc:jane@example.com',
      'enc:Jane',
      'enc:Doe',
      'enc:Jane Doe',
    ]);
    expect(deps.resolveUserDetail).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        userId: 'account-1',
      })
    );
  });

  it('continues profile loading and logs a sanitized warning when session seeding fails', async () => {
    const { client, deps } = createDeps();
    vi.mocked(client.query).mockImplementationOnce(async () => ({ rowCount: 0, rows: [] }));
    vi.mocked(client.query).mockRejectedValueOnce(new Error('seed failed'));
    vi.mocked(client.query).mockImplementation(async () => ({ rowCount: 0, rows: [] }));
    const commands = createProfileCommands(deps);

    const detail = await commands.loadMyProfileDetail(
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
    expect(client.query).toHaveBeenNthCalledWith(1, 'SAVEPOINT iam_profile_session_seed');
    expect(client.query).toHaveBeenNthCalledWith(
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
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK TO SAVEPOINT iam_profile_session_seed');
    expect(client.query).toHaveBeenNthCalledWith(4, 'RELEASE SAVEPOINT iam_profile_session_seed');
    expect(deps.logger.warn).toHaveBeenCalledWith(
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
    expect(vi.mocked(deps.logger.warn).mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(deps.resolveUserDetail).toHaveBeenCalledTimes(1);
  });

  it('updates the local profile and emits an activity log', async () => {
    const { client, deps } = createDeps();
    const commands = createProfileCommands(deps);

    await commands.updateMyProfileDetail(
      {
        instanceId: 'de-musterhausen',
        requestId: 'req-profile',
        traceId: 'trace-profile',
      },
      'kc-1',
      {
        displayName: 'Jane Doe',
        phone: '+49 30 123',
      }
    );

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE iam.accounts'), [
      'account-1',
      'de-musterhausen',
      null,
      null,
      null,
      null,
      'enc:Jane Doe',
      'enc:+49 30 123',
      null,
      null,
      null,
      null,
    ]);
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'user.profile_updated',
        accountId: 'account-1',
      })
    );
  });
});
