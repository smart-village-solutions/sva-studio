import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor, instanceRow } from './test-support.js';

describe('instance registry repository reads', () => {
  it('maps instance list rows and builds list filters', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow]]);

    await expect(
      createInstanceRegistryRepository(executor).listInstances({ search: ' Tenant ', status: 'active' })
    ).resolves.toEqual([
      {
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        status: 'active',
        parentDomain: 'example.test',
        primaryHostname: 'tenant-a.example.test',
        realmMode: 'shared',
        authRealm: 'sva',
        authClientId: 'studio',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretConfigured: false,
        },
        tenantAdminBootstrap: {
          username: 'admin',
          firstName: 'Ada',
        },
        assignedModules: ['news', 'events'],
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        updatedBy: 'actor-1',
      },
    ]);
    expect(statements[0]?.values).toEqual(['Tenant', 'active']);
  });

  it('returns null for missing lookups and reads encrypted credential columns', async () => {
    const { executor } = createQueuedExecutor([
      [],
      [{ auth_client_secret_ciphertext: 'auth-cipher' }],
      [{ tenant_admin_client_secret_ciphertext: null }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getInstanceById('missing')).resolves.toBeNull();
    await expect(repository.getAuthClientSecretCiphertext('tenant-a')).resolves.toBe('auth-cipher');
    await expect(repository.getTenantAdminClientSecretCiphertext('tenant-a')).resolves.toBeNull();
  });

  it('counts active local system_admin assignments', async () => {
    const { executor, statements } = createQueuedExecutor([[{ assignment_count: 2 }]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.countLocalSystemAdminAssignments('tenant-a')).resolves.toBe(2);
    expect(statements[0]?.text).toContain('COUNT(DISTINCT ar.account_id)::int AS assignment_count');
    expect(statements[0]?.text).toContain("r.role_key = 'system_admin'");
    expect(statements[0]?.text).not.toContain('a.instance_id');
    expect(statements[0]?.text).toContain('JOIN iam.instance_memberships im');
  });

  it('lists assigned modules for an instance', async () => {
    const { executor } = createQueuedExecutor([[{ module_id: 'news' }, { module_id: 'poi' }]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.listAssignedModules('tenant-a')).resolves.toEqual(['news', 'poi']);
  });

  it('resolves hostname variants and returns null when they are missing', async () => {
    const { executor } = createQueuedExecutor([[instanceRow], [], [instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.resolveHostname('tenant-a.example.test')).resolves.toMatchObject({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant-a.example.test',
    });
    await expect(repository.resolveHostname('missing.example.test')).resolves.toBeNull();
    await expect(repository.resolvePrimaryHostname('tenant-a.example.test')).resolves.toMatchObject({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant-a.example.test',
    });
    await expect(repository.resolvePrimaryHostname('missing.example.test')).resolves.toBeNull();
  });
});
