import { describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  protectField: (value: string | undefined, context: string) => (value ? `${context}:${value}` : null),
  revealField: (value: string | null, context: string) => (value ? value.replace(`${context}:`, '') : undefined),
}));

import { createUserImportPersistence } from './user-import-persistence.js';
import { IamSchemaDriftError } from './runtime-errors.js';
import type { QueryClient } from './query-client.js';

const logger = {
  error: vi.fn(),
};

describe('user-import-persistence', () => {
  it('upserts imported identity users and ensures tenant membership', async () => {
    const client: QueryClient = {
      query: vi.fn(async (text: string) => {
        if (text.includes('RETURNING id')) {
          return { rowCount: 1, rows: [{ id: 'account-1', created: true }] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    const persistence = createUserImportPersistence({ logger });

    await expect(
      persistence.upsertIdentityUser(client, {
        instanceId: 'inst-1',
        user: {
          externalId: 'kc-1',
          username: 'user-name',
          email: 'user@example.test',
          firstName: 'User',
          lastName: 'Name',
          enabled: true,
        },
      })
    ).resolves.toEqual({ accountId: 'account-1', created: true });

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.accounts'), [
      'inst-1',
      'kc-1',
      'iam.accounts.username:kc-1:user-name',
      'iam.accounts.email:kc-1:user@example.test',
      'iam.accounts.display_name:kc-1:User Name',
      'iam.accounts.first_name:kc-1:User',
      'iam.accounts.last_name:kc-1:Name',
      'active',
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.instance_memberships'), [
      'inst-1',
      'account-1',
    ]);
  });

  it('loads local profile seeds from encrypted account fields', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({
        rowCount: 1,
        rows: [
          {
            username_ciphertext: 'iam.accounts.username:kc-1:user-name',
            email_ciphertext: 'iam.accounts.email:kc-1:user@example.test',
            first_name_ciphertext: 'iam.accounts.first_name:kc-1:User',
            last_name_ciphertext: 'iam.accounts.last_name:kc-1:Name',
          },
        ],
      })),
    };
    const persistence = createUserImportPersistence({ logger });

    await expect(
      persistence.loadLocalProfileSeed(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'kc-1',
      })
    ).resolves.toEqual({
      username: 'user-name',
      email: 'user@example.test',
      firstName: 'User',
      lastName: 'Name',
    });
  });

  it('maps missing username ciphertext schema to schema drift', async () => {
    const schemaError = new Error('column username_ciphertext does not exist');
    const client: QueryClient = {
      query: vi.fn(async () => {
        throw schemaError;
      }),
    };
    const persistence = createUserImportPersistence({ logger });

    await expect(
      persistence.upsertIdentityUser(client, {
        instanceId: 'inst-1',
        user: {
          externalId: 'kc-1',
          email: 'user@example.test',
          firstName: 'User',
          lastName: 'Name',
        },
      })
    ).rejects.toBeInstanceOf(IamSchemaDriftError);

    expect(logger.error).toHaveBeenCalledWith(
      'Keycloak user sync aborted because IAM schema is outdated',
      expect.objectContaining({
        instance_id: 'inst-1',
        schema_object: 'iam.accounts.username_ciphertext',
      })
    );
  });
});
