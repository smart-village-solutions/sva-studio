import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor, instanceRow } from './test-support.js';

describe('instance registry repository reads', () => {
  it('maps instance list rows and builds list filters', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow]]);

    await expect(
      createInstanceRegistryRepository(executor).listInstances({
        search: ' Tenant ',
        status: 'active',
      })
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

  it('maps populated optional instance fields and absent tenant administration', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          ...instanceRow,
          auth_issuer_url: 'https://id.example.test/realms/sva',
          tenant_admin_client_id: null,
          tenant_admin_username: null,
          tenant_admin_email: 'admin@example.test',
          tenant_admin_last_name: 'Lovelace',
          theme_key: 'municipality',
          assigned_module_ids: null,
          feature_flags: { beta: true },
          mainserver_config_ref: 'mainserver-config',
          created_by: 'system',
        },
      ],
    ]);

    await expect(createInstanceRegistryRepository(executor).listInstances({})).resolves.toEqual([
      expect.objectContaining({
        authIssuerUrl: 'https://id.example.test/realms/sva',
        tenantAdminClient: undefined,
        tenantAdminBootstrap: undefined,
        themeKey: 'municipality',
        assignedModules: [],
        featureFlags: { beta: true },
        mainserverConfigRef: 'mainserver-config',
        createdBy: 'system',
      }),
    ]);
  });

  it('maps all optional tenant administrator fields', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          ...instanceRow,
          tenant_admin_email: 'admin@example.test',
          tenant_admin_last_name: 'Lovelace',
          updated_by: null,
        },
      ],
    ]);

    await expect(createInstanceRegistryRepository(executor).listInstances({})).resolves.toEqual([
      expect.objectContaining({
        tenantAdminBootstrap: {
          username: 'admin',
          email: 'admin@example.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
        updatedBy: undefined,
      }),
    ]);
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
    const { executor, statements } = createQueuedExecutor([
      [{ module_id: 'news' }, { module_id: 'poi' }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.listAssignedModules('tenant-a')).resolves.toEqual(['news', 'poi']);
    expect(statements[0]?.text).toContain('AND effective_active');
  });

  it('lists persisted module activation policy, origin, override and revisions', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          instance_id: 'tenant-a',
          module_id: 'events',
          activation_policy: 'automatic',
          activation_origin: 'manual',
          effective_active: false,
          manual_override: 'disabled',
          manifest_version: 1,
          policy_revision: 'events-2',
          state_revision: '4',
          reconcile_id: null,
          reconciled_at: null,
          created_at: '2026-08-30T10:00:00.000Z',
          updated_at: '2026-08-30T11:00:00.000Z',
          updated_by: 'root-admin',
        },
      ],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.listModuleActivations('tenant-a')).resolves.toEqual([
      {
        instanceId: 'tenant-a',
        moduleId: 'events',
        activationPolicy: 'automatic',
        activationOrigin: 'manual',
        effectiveActive: false,
        manualOverride: 'disabled',
        manifestVersion: 1,
        policyRevision: 'events-2',
        stateRevision: 4,
        reconcileId: undefined,
        reconciledAt: undefined,
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T11:00:00.000Z',
        updatedBy: 'root-admin',
      },
    ]);
    expect(statements[0]?.text).toContain('activation_policy');
    expect(statements[0]?.text).toContain('activation_origin');
    expect(statements[0]?.text).toContain('ORDER BY module_id ASC');
  });

  it('resolves hostname variants and returns null when they are missing', async () => {
    const { executor } = createQueuedExecutor([[instanceRow], [], [instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.resolveHostname('tenant-a.example.test')).resolves.toMatchObject({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant-a.example.test',
    });
    await expect(repository.resolveHostname('missing.example.test')).resolves.toBeNull();
    await expect(repository.resolvePrimaryHostname('tenant-a.example.test')).resolves.toMatchObject(
      {
        instanceId: 'tenant-a',
        primaryHostname: 'tenant-a.example.test',
      }
    );
    await expect(repository.resolvePrimaryHostname('missing.example.test')).resolves.toBeNull();
  });
});
