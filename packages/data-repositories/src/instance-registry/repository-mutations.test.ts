import { describe, expect, it } from 'vitest';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';

import { createInstanceRegistryRepository } from './index.js';
import type { InstanceRegistryRepository } from './repository-contract.js';
import { createQueuedExecutor, instanceRow } from './test-support.js';

type CreateInstanceInput = Parameters<InstanceRegistryRepository['createInstance']>[0];
type UpdateInstanceInput = Parameters<InstanceRegistryRepository['updateInstance']>[0];

const minimalCreateInput: CreateInstanceInput = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  status: 'active',
  parentDomain: 'example.test',
  primaryHostname: 'tenant-a.example.test',
  realmMode: 'shared',
  authRealm: 'sva',
  authClientId: 'studio',
};

const minimalUpdateInput: UpdateInstanceInput = {
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  parentDomain: 'example.test',
  primaryHostname: 'tenant-a.example.test',
  realmMode: 'shared',
  authRealm: 'sva',
  authClientId: 'studio',
};

const expectSqlValues = (
  statement: SqlStatement | undefined,
  expectedLength: number,
  expectedValues: readonly SqlPrimitive[]
): void => {
  expect(statement?.values).toHaveLength(expectedLength);
  expect(statement?.values).toStrictEqual(expectedValues);
};

describe('instance registry mutation SQL values', () => {
  it('maps a minimal create input to the exact 20-value contract and upserts the hostname second', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.createInstance(minimalCreateInput)).resolves.toMatchObject({ instanceId: 'tenant-a' });

    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain('INSERT INTO iam.instances');
    expect(statements[0]?.text).toContain('ON CONFLICT (id) DO NOTHING');
    expectSqlValues(statements[0], 20, [
      'tenant-a',
      'Tenant A',
      'active',
      'example.test',
      'tenant-a.example.test',
      'shared',
      'sva',
      'studio',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      '{}',
      null,
      'system',
    ]);
    expect(statements[1]?.text).toContain('INSERT INTO iam.instance_hostnames');
    expect(statements[1]?.values).toStrictEqual(['tenant-a.example.test', 'tenant-a', 'system']);
  });

  it('maps a fully populated create input to the exact 20-value contract', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.createInstance({
      ...minimalCreateInput,
      authIssuerUrl: 'https://issuer.example.test',
      authClientSecretCiphertext: 'auth-cipher',
      tenantAdminClient: { clientId: 'tenant-admin', secretCiphertext: 'tenant-cipher' },
      tenantAdminBootstrap: {
        username: 'tenant-admin-user',
        email: 'admin@example.test',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      themeKey: 'municipal',
      featureFlags: { preview: true, beta: false },
      mainserverConfigRef: 'mainserver-ref',
      actorId: 'actor-1',
    });

    expectSqlValues(statements[0], 20, [
      'tenant-a',
      'Tenant A',
      'active',
      'example.test',
      'tenant-a.example.test',
      'shared',
      'sva',
      'studio',
      'https://issuer.example.test',
      'auth-cipher',
      'tenant-admin',
      'tenant-cipher',
      'tenant-admin-user',
      'admin@example.test',
      'Ada',
      'Lovelace',
      'municipal',
      '{"preview":true,"beta":false}',
      'mainserver-ref',
      'actor-1',
    ]);
  });

  it('normalizes partial tenant-admin runtime objects without shifting create positions', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);
    const partialInput = {
      ...minimalCreateInput,
      tenantAdminClient: { secretCiphertext: 'tenant-cipher' },
      tenantAdminBootstrap: { email: 'admin@example.test' },
    } as unknown as CreateInstanceInput;

    await repository.createInstance(partialInput);

    expect(statements[0]?.values.slice(10, 16)).toStrictEqual([
      null,
      'tenant-cipher',
      null,
      'admin@example.test',
      null,
      null,
    ]);
    expect(statements[0]?.values).toHaveLength(20);
  });

  it('maps a minimal update input to the exact 21-value contract and upserts the hostname second', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.updateInstance(minimalUpdateInput)).resolves.toMatchObject({ instanceId: 'tenant-a' });

    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain('UPDATE iam.instances');
    expectSqlValues(statements[0], 21, [
      'tenant-a',
      'Tenant A',
      'example.test',
      'tenant-a.example.test',
      'shared',
      'sva',
      'studio',
      null,
      true,
      null,
      null,
      true,
      null,
      null,
      null,
      null,
      null,
      null,
      '{}',
      null,
      'system',
    ]);
    expect(statements[1]?.text).toContain('INSERT INTO iam.instance_hostnames');
    expect(statements[1]?.values).toStrictEqual(['tenant-a.example.test', 'tenant-a', 'system']);
  });

  it('maps a fully populated update input to the exact 21-value contract', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.updateInstance({
      ...minimalUpdateInput,
      authIssuerUrl: 'https://issuer.example.test',
      authClientSecretCiphertext: 'auth-cipher',
      keepExistingAuthClientSecret: false,
      tenantAdminClient: { clientId: 'tenant-admin', secretCiphertext: 'tenant-cipher' },
      keepExistingTenantAdminClientSecret: false,
      tenantAdminBootstrap: {
        username: 'tenant-admin-user',
        email: 'admin@example.test',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      themeKey: 'municipal',
      featureFlags: { preview: true, beta: false },
      mainserverConfigRef: 'mainserver-ref',
      actorId: 'actor-1',
    });

    expectSqlValues(statements[0], 21, [
      'tenant-a',
      'Tenant A',
      'example.test',
      'tenant-a.example.test',
      'shared',
      'sva',
      'studio',
      'https://issuer.example.test',
      false,
      'auth-cipher',
      'tenant-admin',
      false,
      'tenant-cipher',
      'tenant-admin-user',
      'admin@example.test',
      'Ada',
      'Lovelace',
      'municipal',
      '{"preview":true,"beta":false}',
      'mainserver-ref',
      'actor-1',
    ]);
  });

  it('normalizes partial tenant-admin runtime objects without shifting update positions', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);
    const partialInput = {
      ...minimalUpdateInput,
      tenantAdminClient: { secretCiphertext: 'tenant-cipher' },
      tenantAdminBootstrap: { email: 'admin@example.test' },
    } as unknown as UpdateInstanceInput;

    await repository.updateInstance(partialInput);

    expect(statements[0]?.values.slice(10, 17)).toStrictEqual([
      null,
      false,
      'tenant-cipher',
      null,
      'admin@example.test',
      null,
      null,
    ]);
    expect(statements[0]?.values).toHaveLength(21);
  });
});

type SecretCase = {
  readonly label: string;
  readonly keep: boolean | undefined;
  readonly ciphertext: string | null | undefined;
  readonly expectedKeep: boolean;
  readonly expectedCiphertext: string | null;
};

const secretCases: readonly SecretCase[] = [
  { label: 'undefined keep with undefined ciphertext', keep: undefined, ciphertext: undefined, expectedKeep: true, expectedCiphertext: null },
  { label: 'true keep with undefined ciphertext', keep: true, ciphertext: undefined, expectedKeep: true, expectedCiphertext: null },
  { label: 'false keep with undefined ciphertext', keep: false, ciphertext: undefined, expectedKeep: false, expectedCiphertext: null },
  { label: 'undefined keep with null ciphertext', keep: undefined, ciphertext: null, expectedKeep: false, expectedCiphertext: null },
  { label: 'true keep with null ciphertext', keep: true, ciphertext: null, expectedKeep: false, expectedCiphertext: null },
  { label: 'false keep with null ciphertext', keep: false, ciphertext: null, expectedKeep: false, expectedCiphertext: null },
  { label: 'undefined keep with ciphertext', keep: undefined, ciphertext: 'cipher', expectedKeep: false, expectedCiphertext: 'cipher' },
  { label: 'true keep with ciphertext', keep: true, ciphertext: 'cipher', expectedKeep: false, expectedCiphertext: 'cipher' },
  { label: 'false keep with ciphertext', keep: false, ciphertext: 'cipher', expectedKeep: false, expectedCiphertext: 'cipher' },
];

describe('instance registry update secret preservation matrix', () => {
  it.each(secretCases)('maps auth-client $label', async ({ keep, ciphertext, expectedKeep, expectedCiphertext }) => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);
    const input = {
      ...minimalUpdateInput,
      keepExistingAuthClientSecret: keep,
      authClientSecretCiphertext: ciphertext,
    } as unknown as UpdateInstanceInput;

    await expect(repository.updateInstance(input)).resolves.toBeNull();

    expect(statements[0]?.values).toHaveLength(21);
    expect(statements[0]?.values.slice(8, 10)).toStrictEqual([expectedKeep, expectedCiphertext]);
  });

  it.each(secretCases)('maps tenant-admin-client $label', async ({ keep, ciphertext, expectedKeep, expectedCiphertext }) => {
    const { executor, statements } = createQueuedExecutor([[]]);
    const repository = createInstanceRegistryRepository(executor);
    const input = {
      ...minimalUpdateInput,
      keepExistingTenantAdminClientSecret: keep,
      tenantAdminClient: { clientId: 'tenant-admin', secretCiphertext: ciphertext },
    } as unknown as UpdateInstanceInput;

    await expect(repository.updateInstance(input)).resolves.toBeNull();

    expect(statements[0]?.values).toHaveLength(21);
    expect(statements[0]?.values.slice(10, 13)).toStrictEqual([
      'tenant-admin',
      expectedKeep,
      expectedCiphertext,
    ]);
  });
});

describe('instance registry mutation result and error contracts', () => {
  it('does not upsert a hostname when create or update returns no row', async () => {
    const createExecution = createQueuedExecutor([[]]);
    const createRepository = createInstanceRegistryRepository(createExecution.executor);
    const updateExecution = createQueuedExecutor([[]]);
    const updateRepository = createInstanceRegistryRepository(updateExecution.executor);

    await expect(createRepository.createInstance(minimalCreateInput)).resolves.toBeNull();
    await expect(updateRepository.updateInstance(minimalUpdateInput)).resolves.toBeNull();

    expect(createExecution.statements).toHaveLength(1);
    expect(updateExecution.statements).toHaveLength(1);
  });

  it('preserves insert and update database error identity', async () => {
    const insertError = new Error('sensitive insert diagnostics');
    const updateError = new Error('sensitive update diagnostics');
    const throwingExecutor = (error: Error): SqlExecutor => ({
      execute: async () => {
        throw error;
      },
    });

    await expect(
      createInstanceRegistryRepository(throwingExecutor(insertError)).createInstance(minimalCreateInput)
    ).rejects.toBe(insertError);
    expect((insertError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe('registry_insert');
    await expect(
      createInstanceRegistryRepository(throwingExecutor(updateError)).updateInstance(minimalUpdateInput)
    ).rejects.toBe(updateError);
    expect((updateError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBeUndefined();
  });

  it('preserves create and update hostname error identity and their existing annotations', async () => {
    const hostnameExecutor = (error: Error): SqlExecutor => {
      let invocation = 0;
      return {
        execute: async <TRow>() => {
          invocation += 1;
          if (invocation === 1) {
            return { rowCount: 1, rows: [instanceRow] as readonly TRow[] };
          }
          throw error;
        },
      };
    };
    const createHostnameError = new Error('sensitive create-hostname diagnostics');
    const updateHostnameError = new Error('sensitive update-hostname diagnostics');

    await expect(
      createInstanceRegistryRepository(hostnameExecutor(createHostnameError)).createInstance(minimalCreateInput)
    ).rejects.toBe(createHostnameError);
    expect((createHostnameError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe(
      'primary_hostname_upsert'
    );
    await expect(
      createInstanceRegistryRepository(hostnameExecutor(updateHostnameError)).updateInstance(minimalUpdateInput)
    ).rejects.toBe(updateHostnameError);
    expect((updateHostnameError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBeUndefined();
  });
});
