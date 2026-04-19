import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IamSchemaDriftError } from './runtime-errors.js';

const state = vi.hoisted(() => ({
  listUsersImpl: null as null | (() => unknown[]),
  updateUserCalls: [] as Array<{
    externalId: string;
    input: {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
      attributes?: Readonly<Record<string, string | readonly string[]>>;
    };
  }>,
  withInstanceScopedDbImpl: null as null | ((instanceId: string, work: (client: unknown) => Promise<unknown>) => Promise<unknown>),
  identityProviderRealm: 'de-musterhausen',
  identityProviderSource: 'instance' as 'instance' | 'global',
  identityProviderExecutionMode: 'tenant_admin' as 'platform_admin' | 'tenant_admin' | 'break_glass',
  emitActivityLog: vi.fn(async () => undefined),
  logger: {
    isLevelEnabled: vi.fn(() => false),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
        updateUser: async (
          externalId: string,
          input: {
            username?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            enabled?: boolean;
            attributes?: Readonly<Record<string, string | readonly string[]>>;
          }
        ) => {
          state.updateUserCalls.push({ externalId, input });
        },
      },
      realm: state.identityProviderRealm,
      source: state.identityProviderSource,
      executionMode: state.identityProviderExecutionMode,
    }),
    resolveIdentityProviderForInstance: async () => ({
      provider: {
        listUsers: async () => state.listUsersImpl?.() ?? [],
        updateUser: async (
          externalId: string,
          input: {
            username?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            enabled?: boolean;
            attributes?: Readonly<Record<string, string | readonly string[]>>;
          }
        ) => {
          state.updateUserCalls.push({ externalId, input });
        },
      },
      realm: state.identityProviderRealm,
      source: state.identityProviderSource,
      executionMode: state.identityProviderExecutionMode,
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
      debug: (...args: Parameters<typeof state.logger.debug>) => state.logger.debug(...args),
      info: (...args: Parameters<typeof state.logger.info>) => state.logger.info(...args),
      warn: (...args: Parameters<typeof state.logger.warn>) => state.logger.warn(...args),
      error: (...args: Parameters<typeof state.logger.error>) => state.logger.error(...args),
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
    state.updateUserCalls = [];
    state.withInstanceScopedDbImpl = null;
    state.identityProviderRealm = 'de-musterhausen';
    state.identityProviderSource = 'instance';
    state.identityProviderExecutionMode = 'tenant_admin';
    state.emitActivityLog.mockReset();
    state.emitActivityLog.mockResolvedValue(undefined);
    state.logger.isLevelEnabled.mockReset();
    state.logger.isLevelEnabled.mockReturnValue(false);
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
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
      outcome: 'success',
      checkedCount: 2,
      correctedCount: 2,
      manualReviewCount: 0,
      importedCount: 1,
      updatedCount: 1,
      skippedCount: 1,
      totalKeycloakUsers: 3,
      diagnostics: {
        authRealm: 'de-musterhausen',
        providerSource: 'instance',
        executionMode: 'tenant_admin',
        skippedInstanceIds: ['other-instance'],
      },
    });
    expect(state.logger.info).toHaveBeenCalledWith(
      'sync_keycloak_users_completed',
      expect.objectContaining({
        instance_id: 'hb-meinquartier',
        imported_count: 1,
        updated_count: 1,
        skipped_count: 1,
        total_keycloak_users: 3,
      })
    );
  });

  it('matches users without instanceId attribute when the import already runs against an instance realm', async () => {
    state.identityProviderRealm = 'de-musterhausen';
    state.identityProviderSource = 'instance';
    state.listUsersImpl = () => [
      {
        externalId: 'kc-tenant-user',
        username: 'tenant.user',
        email: 'tenant@example.com',
        firstName: 'Tenant',
        lastName: 'User',
        enabled: true,
      },
    ];

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
      instanceId: 'de-musterhausen',
    });

    expect(result.report).toEqual({
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 1,
      manualReviewCount: 0,
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 1,
      diagnostics: {
        authRealm: 'de-musterhausen',
        providerSource: 'instance',
        executionMode: 'tenant_admin',
        matchedWithoutInstanceAttributeCount: 1,
      },
    });
    expect(state.logger.info).toHaveBeenCalledWith(
      'Keycloak user sync matched users by realm scope without instance attribute',
      expect.objectContaining({
        auth_realm: 'de-musterhausen',
        matched_without_instance_attribute_count: 1,
        provider_source: 'instance',
      })
    );
  });

  it('repairs missing keycloak profile fields from local account data before importing', async () => {
    state.identityProviderRealm = 'de-musterhausen';
    state.identityProviderSource = 'instance';
    state.listUsersImpl = () => [
      {
        externalId: 'kc-profile-gap',
        username: 'legacy.user@example.com',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
    ];

    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('FROM iam.accounts') && text.includes('keycloak_subject = $2')) {
            return {
              rows: [
                {
                  username_ciphertext: null,
                  email_ciphertext: null,
                  first_name_ciphertext: 'Philipp',
                  last_name_ciphertext: 'Wilimzig',
                },
              ],
            };
          }
          if (text.includes('INSERT INTO iam.accounts')) {
            return {
              rows: [{ id: '11111111-1111-4111-8111-111111111111', created: false }],
            };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'de-musterhausen',
      requestId: 'req-sync',
      traceId: 'trace-sync',
    });

    expect(state.updateUserCalls).toEqual([
      {
        externalId: 'kc-profile-gap',
        input: {
          username: 'legacy.user@example.com',
          email: 'legacy.user@example.com',
          firstName: 'Philipp',
          lastName: 'Wilimzig',
        },
      },
    ]);
    expect(result.report).toEqual({
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 1,
      manualReviewCount: 0,
      importedCount: 0,
      updatedCount: 1,
      repairedProfileCount: 1,
      skippedCount: 0,
      totalKeycloakUsers: 1,
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
      outcome: 'success',
      checkedCount: 1,
      correctedCount: 1,
      manualReviewCount: 0,
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

  it('continues with manual review when a user profile stays incomplete after repair', async () => {
    state.identityProviderRealm = 'de-musterhausen';
    state.identityProviderSource = 'instance';
    state.listUsersImpl = () => [
      {
        externalId: 'kc-complete',
        username: 'complete.user',
        email: 'complete@example.com',
        firstName: 'Complete',
        lastName: 'User',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
      {
        externalId: 'kc-incomplete',
        username: 'incomplete.user',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
    ];

    let upsertCount = 0;
    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('FROM iam.accounts') && text.includes('keycloak_subject = $2')) {
            return { rows: [] };
          }
          if (text.includes('INSERT INTO iam.accounts')) {
            upsertCount += 1;
            return {
              rows: [{ id: `11111111-1111-4111-8111-11111111111${upsertCount}`, created: true }],
            };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'de-musterhausen',
      requestId: 'req-sync',
      traceId: 'trace-sync',
    });

    expect(result.report).toEqual({
      outcome: 'partial_failure',
      checkedCount: 2,
      correctedCount: 1,
      manualReviewCount: 1,
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 2,
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Keycloak user sync left a user in manual review',
      expect.objectContaining({
        instance_id: 'de-musterhausen',
        reason: 'identity_profile_incomplete',
        subject_ref: expect.any(String),
      })
    );
  });

  it('fails with manual review outcome when all matched users stay incomplete', async () => {
    state.identityProviderRealm = 'de-musterhausen';
    state.identityProviderSource = 'instance';
    state.listUsersImpl = () => [
      {
        externalId: 'kc-incomplete',
        username: 'incomplete.user',
        enabled: true,
        attributes: {
          instanceId: ['de-musterhausen'],
        },
      },
    ];

    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('FROM iam.accounts') && text.includes('keycloak_subject = $2')) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    const result = await runKeycloakUserImportSync({
      instanceId: 'de-musterhausen',
    });

    expect(result.report).toEqual({
      outcome: 'failed',
      checkedCount: 1,
      correctedCount: 0,
      manualReviewCount: 1,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalKeycloakUsers: 1,
    });
  });

  it('propagates non-recoverable write failures instead of downgrading them to manual review', async () => {
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
        },
      },
    ];

    state.withInstanceScopedDbImpl = async (_instanceId, work) =>
      work({
        query: async (text: string) => {
          if (text.includes('INSERT INTO iam.accounts')) {
            throw new Error('deadlock detected');
          }
          return { rows: [] };
        },
      });

    const { runKeycloakUserImportSync } = await import('./iam-account-management/user-import-sync-handler.js');

    await expect(
      runKeycloakUserImportSync({
        instanceId: 'hb-meinquartier',
      })
    ).rejects.toThrow('deadlock detected');
  });

  it('fails fast when username_ciphertext is missing in the schema', async () => {
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

    await expect(
      runKeycloakUserImportSync({
        instanceId: 'hb-meinquartier',
      })
    ).rejects.toBeInstanceOf(IamSchemaDriftError);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Keycloak user sync aborted because IAM schema is outdated',
      expect.objectContaining({
        instance_id: 'hb-meinquartier',
        subject_ref: expect.any(String),
        schema_object: 'iam.accounts.username_ciphertext',
      })
    );
  });
});
