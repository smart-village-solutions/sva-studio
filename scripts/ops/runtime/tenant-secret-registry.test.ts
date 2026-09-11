import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTenantSecretRegistryOps } from './tenant-secret-registry.ts';

const {
  loadInstanceWithSecret,
  syncProvisionedClientSecretToRegistry,
  withInstanceProvisioningLock,
  withRegistryProvisioningWorkerDeps,
} = vi.hoisted(() => ({
  loadInstanceWithSecret: vi.fn<(...args: readonly unknown[]) => Promise<unknown | null>>(async () => null),
  syncProvisionedClientSecretToRegistry: vi.fn(async () => undefined),
  withInstanceProvisioningLock: vi.fn(async (_instanceId: string, operation: (deps: unknown) => Promise<unknown>) =>
    operation({ repository: { listInstances: async () => [{ instanceId: 'tenant-a' }] } }),
  ),
  withRegistryProvisioningWorkerDeps: vi.fn(
    async (
      operation: (deps: {
        repository: { listInstances: (input: { status: string }) => Promise<readonly { instanceId: string }[]> };
        withInstanceProvisioningLock: typeof withInstanceProvisioningLock;
      }) => Promise<unknown>,
    ) =>
      operation({
        repository: {
          listInstances: async () => [{ instanceId: 'tenant-a' }],
        },
        withInstanceProvisioningLock,
      }),
  ),
}));

vi.mock('../../../packages/auth-runtime/src/iam-instance-registry/service-keycloak-execution-shared.ts', () => ({
  syncProvisionedClientSecretToRegistry,
}));

vi.mock('../../../packages/auth-runtime/src/iam-instance-registry/service-keycloak.ts', () => ({
  loadInstanceWithSecret,
}));

vi.mock('../../../packages/auth-runtime/src/iam-instance-registry/repository.ts', () => ({
  withRegistryProvisioningWorkerDeps,
}));

describe('tenant secret registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes the instance id in runtime repair request ids', async () => {
    loadInstanceWithSecret
      .mockResolvedValueOnce({
        authClientSecret: null,
        instance: {
          authClientSecretConfigured: false,
          instanceId: 'tenant-a',
          tenantAdminClient: null,
        },
        tenantAdminClientSecret: null,
      })
      .mockResolvedValueOnce({
        authClientSecret: null,
        instance: {
          authClientSecretConfigured: false,
          instanceId: 'tenant-a',
          tenantAdminClient: null,
        },
        tenantAdminClientSecret: null,
      })
      .mockResolvedValueOnce({
        authClientSecret: 'restored-secret',
        instance: {
          authClientSecretConfigured: true,
          instanceId: 'tenant-a',
          tenantAdminClient: null,
        },
        tenantAdminClientSecret: null,
      });

    const ops = createTenantSecretRegistryOps({
      createDbSqlRunner: vi.fn(),
      isRemoteRuntimeProfile: vi.fn(() => false),
      parseJsonFromCommandOutput: vi.fn(),
      withTemporaryProcessEnv: async (_env, operation) => operation(),
    });

    await ops.syncLocalTenantSecretsToRegistry({});

    expect(syncProvisionedClientSecretToRegistry).toHaveBeenCalledTimes(1);
    expect(withInstanceProvisioningLock).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(syncProvisionedClientSecretToRegistry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requestId: expect.stringMatching(/^runtime-env-repair-tenant-a-\d+$/),
      }),
    );
  });

  it('avoids nested process env wrapping during local tenant secret sync', async () => {
    loadInstanceWithSecret
      .mockResolvedValueOnce({
        authClientSecret: null,
        instance: {
          authClientSecretConfigured: false,
          instanceId: 'tenant-a',
          tenantAdminClient: null,
        },
        tenantAdminClientSecret: null,
      })
      .mockResolvedValueOnce({
        authClientSecret: 'restored-secret',
        instance: {
          authClientSecretConfigured: true,
          instanceId: 'tenant-a',
          tenantAdminClient: null,
        },
        tenantAdminClientSecret: null,
      });

    const envWrapCalls: string[] = [];
    const withTemporaryProcessEnv = async <T>(_env: NodeJS.ProcessEnv, operation: () => Promise<T>): Promise<T> => {
      envWrapCalls.push('wrapped');
      return await operation();
    };
    const ops = createTenantSecretRegistryOps({
      createDbSqlRunner: vi.fn(),
      isRemoteRuntimeProfile: vi.fn(() => false),
      parseJsonFromCommandOutput: vi.fn(),
      withTemporaryProcessEnv,
    });

    await ops.syncLocalTenantSecretsToRegistry({});

    expect(envWrapCalls).toHaveLength(1);
  });
});
