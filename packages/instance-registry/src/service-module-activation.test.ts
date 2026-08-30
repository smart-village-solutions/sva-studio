import { describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import { createInstanceRegistryService } from './service.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const createDeps = (input?: {
  readonly changedModuleIds?: readonly string[];
  readonly conflictModuleIds?: readonly string[];
  readonly snapshotRevision?: string;
}) => {
  const changedModuleIds = input?.changedModuleIds ?? ['events'];
  const repository = {
    reconcileModuleActivationPolicies: vi.fn(async () => ({
      changedModuleIds,
      conflictModuleIds: input?.conflictModuleIds ?? [],
      unchangedModuleIds: changedModuleIds.length === 0 ? ['events'] : [],
    })),
    listAssignedModules: vi.fn(async () => ['events']),
    syncAssignedModuleIam: vi.fn(async () => ({
      permissionsInserted: 1,
      permissionsUpdated: 0,
      permissionsUnchanged: 0,
      grantsInserted: 1,
      grantsUnchanged: 0,
    })),
    appendAuditEvent: vi.fn(async () => undefined),
  } as unknown as InstanceRegistryRepository;
  const invalidatePermissionSnapshots = vi.fn(async () => undefined);
  const deps: InstanceRegistryServiceDeps = {
    repository,
    invalidateHost: vi.fn(),
    invalidatePermissionSnapshots,
    moduleIamRegistry: new Map([
      [
        'events',
        {
          moduleId: 'events',
          permissionIds: ['events.read'],
          tenantBootstrapRoles: [{ roleName: 'system_admin', permissionIds: ['events.read'] }],
        },
      ],
    ]),
    readModuleActivationPolicySnapshot: () => ({
      revision: input?.snapshotRevision ?? 'catalog-1',
      modules: [
        {
          moduleId: 'events',
          activationPolicy: 'automatic',
          manifestVersion: 1,
          policyRevision: 'events-1',
        },
      ],
    }),
  };
  return { deps, repository, invalidatePermissionSnapshots };
};

describe('instance module activation policy reconcile', () => {
  it('materializes policy changes and atomically synchronizes IAM and audit evidence', async () => {
    const { deps, repository, invalidatePermissionSnapshots } = createDeps();

    await expect(
      createInstanceRegistryService(deps).reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
        actorId: 'system',
        requestId: 'request-1',
      })
    ).resolves.toEqual({
      changedModuleIds: ['events'],
      conflictModuleIds: [],
      unchangedModuleIds: [],
    });

    expect(repository.reconcileModuleActivationPolicies).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      policies: [
        {
          moduleId: 'events',
          activationPolicy: 'automatic',
          manifestVersion: 1,
          policyRevision: 'events-1',
        },
      ],
      reconcileId: 'catalog-1',
      actorId: 'system',
    });
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledTimes(1);
    expect(invalidatePermissionSnapshots).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      trigger: 'instance_module_policy_reconciled',
    });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        eventType: 'instance_module_policy_reconciled',
        actorId: 'system',
        requestId: 'request-1',
      })
    );
  });

  it('does not repeat IAM or audit work for an unchanged policy revision', async () => {
    const { deps, repository, invalidatePermissionSnapshots } = createDeps({
      changedModuleIds: [],
    });

    await expect(
      createInstanceRegistryService(deps).reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
      })
    ).resolves.toEqual({
      changedModuleIds: [],
      conflictModuleIds: [],
      unchangedModuleIds: ['events'],
    });

    expect(repository.syncAssignedModuleIam).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
    expect(invalidatePermissionSnapshots).not.toHaveBeenCalled();
  });

  it('fails closed before IAM synchronization when policy reconciliation loses a lock', async () => {
    const { deps, repository, invalidatePermissionSnapshots } = createDeps({
      changedModuleIds: [],
      conflictModuleIds: ['events'],
    });

    await expect(
      createInstanceRegistryService(deps).reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
      })
    ).rejects.toThrow('plugin_activation_state_conflict:events');

    expect(repository.syncAssignedModuleIam).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
    expect(invalidatePermissionSnapshots).not.toHaveBeenCalled();
  });

  it('is a no-op before the host snapshot is configured', async () => {
    const { deps, repository } = createDeps({ snapshotRevision: '' });

    await expect(
      createInstanceRegistryService(deps).reconcileModuleActivationPolicies({
        instanceId: 'tenant-a',
      })
    ).resolves.toEqual({
      changedModuleIds: [],
      conflictModuleIds: [],
      unchangedModuleIds: [],
    });

    expect(repository.reconcileModuleActivationPolicies).not.toHaveBeenCalled();
  });

  it('reconciles a configured empty catalog so removed plugins are deactivated', async () => {
    const { deps, repository } = createDeps();
    deps.moduleIamRegistry = new Map();
    vi.mocked(repository.listAssignedModules).mockResolvedValueOnce([]);
    deps.readModuleActivationPolicySnapshot = () => ({
      revision: 'plugin-catalog:empty',
      modules: [],
    });

    await createInstanceRegistryService(deps).reconcileModuleActivationPolicies({
      instanceId: 'tenant-a',
    });

    expect(repository.reconcileModuleActivationPolicies).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      policies: [],
      reconcileId: 'plugin-catalog:empty',
      actorId: undefined,
    });
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      managedModuleIds: ['events'],
      managedContracts: [],
      contracts: [],
    });
  });
});
