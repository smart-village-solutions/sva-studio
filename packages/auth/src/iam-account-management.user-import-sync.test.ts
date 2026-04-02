import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listUsersImpl: null as null | (() => unknown[]),
  withInstanceScopedDbImpl: null as null | ((instanceId: string, work: (client: unknown) => Promise<unknown>) => Promise<unknown>),
  emitActivityLog: vi.fn(async () => undefined),
  logger: {
    isLevelEnabled: vi.fn(() => false),
    warn: vi.fn(),
  },
}));

vi.mock('./iam-account-management/shared.js', async () => {
  const actual = await vi.importActual<typeof import('./iam-account-management/shared.js')>(
    './iam-account-management/shared.js'
  );

  return {
    ...actual,
    resolveIdentityProvider: () => ({
      provider: {
        listUsers: async () => state.listUsersImpl?.() ?? [],
      },
    }),
    resolveIdentityProviderForInstance: async () => ({
      provider: {
        listUsers: async () => state.listUsersImpl?.() ?? [],
      },
    }),
    trackKeycloakCall: async (_operation: string, execute: () => Promise<unknown>) => execute(),
    withInstanceScopedDb: async (instanceId: string, work: (client: unknown) => Promise<unknown>) => {
      if (state.withInstanceScopedDbImpl) {
        return state.withInstanceScopedDbImpl(instanceId, work);
      }

      return work({
        query: async () => ({ rows: [] }),
      });
    },
    emitActivityLog: (...args: Parameters<typeof state.emitActivityLog>) => state.emitActivityLog(...args),
    logger: {
      ...actual.logger,
      isLevelEnabled: (...args: Parameters<typeof state.logger.isLevelEnabled>) =>
        state.logger.isLevelEnabled(...args),
      warn: (...args: Parameters<typeof state.logger.warn>) => state.logger.warn(...args),
    },
  };
});

describe('runKeycloakUserImportSync', () => {
  const originalEnv = {
    IAM_PII_ACTIVE_KEY_ID: process.env.IAM_PII_ACTIVE_KEY_ID,
    IAM_PII_KEYRING_JSON: process.env.IAM_PII_KEYRING_JSON,
  };

  beforeEach(() => {
    state.listUsersImpl = null;
    state.withInstanceScopedDbImpl = null;
    state.emitActivityLog.mockReset();
    state.emitActivityLog.mockResolvedValue(undefined);
    state.logger.isLevelEnabled.mockReset();
    state.logger.isLevelEnabled.mockReturnValue(false);
    state.logger.warn.mockReset();
    process.env.IAM_PII_ACTIVE_KEY_ID = 'k1';
    process.env.IAM_PII_KEYRING_JSON = '{"k1":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="}';
  });

  afterEach(() => {
    process.env.IAM_PII_ACTIVE_KEY_ID = originalEnv.IAM_PII_ACTIVE_KEY_ID;
    process.env.IAM_PII_KEYRING_JSON = originalEnv.IAM_PII_KEYRING_JSON;
    vi.clearAllMocks();
  });

  it('rewrites matching keycloak users without requiring an actor account id', async () => {
    state.listUsersImpl = () => [
      {
        externalId: 'kc-created',
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        enabled: true,
        attributes: {
          instanceId: ['hb-meinquartier'],
          displayName: ['Alice Example'],
        },
      },
      {
        externalId: 'kc-updated',
        username: 'bob',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Example',
        enabled: false,
        attributes: {
          instanceId: ['hb-meinquartier'],
        },
      },
      {
        externalId: 'kc-skipped',
        username: 'skip',
        attributes: {
          instanceId: ['other-instance'],
        },
      },
    ];

    let upsertCount = 0;
    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('INSERT INTO iam.accounts')) {
            upsertCount += 1;
            return {
              rows: [
                {
                  id:
                    upsertCount === 1
                      ? '11111111-1111-4111-8111-111111111111'
                      : '22222222-2222-4222-8222-222222222222',
                  created: upsertCount === 1,
                },
              ],
            };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'hb-meinquartier',
    });

    expect(result.report).toEqual({
      importedCount: 1,
      updatedCount: 1,
      skippedCount: 1,
      totalKeycloakUsers: 3,
    });
  });

  it('does not fail a successful import when audit logging fails afterwards', async () => {
    state.listUsersImpl = () => [
      {
        externalId: 'kc-created',
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        enabled: true,
        attributes: {
          instanceId: ['hb-meinquartier'],
          displayName: ['Alice Example'],
        },
      },
    ];
    state.emitActivityLog.mockRejectedValueOnce(new Error('activity_log_insert_failed'));
    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('INSERT INTO iam.accounts')) {
            return {
              rows: [{ id: '11111111-1111-4111-8111-111111111111', created: true }],
            };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'hb-meinquartier',
      actorAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'req-sync',
      traceId: 'trace-sync',
    });

    expect(result.report).toEqual({
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 1,
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Skipped audit log for Keycloak user sync after successful import',
      expect.objectContaining({
        actor_account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        error: 'activity_log_insert_failed',
        instance_id: 'hb-meinquartier',
        request_id: 'req-sync',
        trace_id: 'trace-sync',
      })
    );
  });

  it('falls back to a legacy account upsert when username_ciphertext is missing in the schema', async () => {
    state.listUsersImpl = () => [
      {
        externalId: 'kc-legacy',
        username: 'legacy.user',
        email: 'legacy@example.com',
        firstName: 'Legacy',
        lastName: 'User',
        enabled: true,
        attributes: {
          instanceId: ['hb-meinquartier'],
        },
      },
    ];

    let upsertAttempts = 0;
    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('INSERT INTO iam.accounts')) {
            upsertAttempts += 1;
            if (upsertAttempts === 1) {
              throw new Error('column "username_ciphertext" of relation "accounts" does not exist');
            }
            return {
              rows: [{ id: '33333333-3333-4333-8333-333333333333', created: true }],
            };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'hb-meinquartier',
    });

    expect(result.report).toEqual({
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 1,
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Keycloak user sync fell back to legacy account upsert without username ciphertext',
      expect.objectContaining({
        instance_id: 'hb-meinquartier',
        subject_ref: expect.any(String),
      })
    );
  });
});
