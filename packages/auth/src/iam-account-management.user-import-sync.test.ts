import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listUsersImpl: null as null | (() => unknown[]),
  withInstanceScopedDbImpl: null as null | ((instanceId: string, work: (client: unknown) => Promise<unknown>) => Promise<unknown>),
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
    trackKeycloakCall: async (_operation: string, execute: () => Promise<unknown>) => execute(),
    withInstanceScopedDb: async (instanceId: string, work: (client: unknown) => Promise<unknown>) => {
      if (state.withInstanceScopedDbImpl) {
        return state.withInstanceScopedDbImpl(instanceId, work);
      }

      return work({
        query: async () => ({ rows: [] }),
      });
    },
    emitActivityLog: vi.fn(async () => undefined),
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
});
