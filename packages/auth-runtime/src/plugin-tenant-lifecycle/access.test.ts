import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  registry: new Map<string, { operations: readonly { jobTypeId: string }[] }>(),
  readiness: vi.fn(),
  getModuleActivationPolicy: vi.fn(),
}));

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginTenantLifecycleRegistry: () => state.registry,
}));
vi.mock('./read-model.js', () => ({
  readConfiguredPluginTenantReadiness: state.readiness,
}));
vi.mock('../iam-instance-registry/repository.js', () => ({
  withRegistryRepository: async (work: (repository: unknown) => Promise<unknown>) =>
    work({ getModuleActivationPolicy: state.getModuleActivationPolicy }),
}));

import {
  filterConfiguredPluginTenantAccessibleModules,
  isConfiguredPluginTenantEffectivelyActive,
  isConfiguredPluginTenantLifecycleJobType,
  readConfiguredPluginTenantAccess,
} from './access.js';

describe('configured plugin tenant access', () => {
  beforeEach(() => {
    state.registry.clear();
    state.readiness.mockReset().mockResolvedValue([]);
    state.getModuleActivationPolicy.mockReset().mockResolvedValue(null);
  });

  it('reads effective activation for lifecycle worker execution', async () => {
    state.getModuleActivationPolicy.mockResolvedValueOnce({ effectiveActive: true });

    await expect(isConfiguredPluginTenantEffectivelyActive('tenant-a', 'speech')).resolves.toBe(
      true
    );
    expect(state.getModuleActivationPolicy).toHaveBeenCalledWith('tenant-a', 'speech');
  });

  it('keeps plugins without a lifecycle contract backward compatible', async () => {
    await expect(readConfiguredPluginTenantAccess('tenant-a', 'news')).resolves.toEqual({
      allowed: true,
      reason: 'not_managed',
    });
    expect(state.readiness).not.toHaveBeenCalled();
  });

  it('removes blocked and missing managed plugins while retaining unmanaged modules', async () => {
    state.registry.set('speech', {
      operations: [{ jobTypeId: 'speech.readiness' }],
    });
    state.registry.set('waste', {
      operations: [{ jobTypeId: 'waste.readiness' }],
    });
    state.readiness.mockResolvedValue([
      {
        pluginId: 'speech',
        activationPolicy: 'required',
        effectiveActive: true,
        accessState: 'active',
        status: 'blocked',
        evidenceState: 'valid',
        desiredGeneration: 1,
        completedGeneration: 1,
        checks: [],
        updatedAt: '2026-08-30T00:00:00.000Z',
      },
    ]);

    await expect(
      filterConfiguredPluginTenantAccessibleModules('tenant-a', ['news', 'speech', 'waste'])
    ).resolves.toEqual(['news']);
  });

  it('recognizes lifecycle job types so the generic job endpoint cannot bypass orchestration', () => {
    state.registry.set('speech', {
      operations: [{ jobTypeId: 'speech.reconcile' }],
    });

    expect(isConfiguredPluginTenantLifecycleJobType('speech', 'speech.reconcile')).toBe(true);
    expect(isConfiguredPluginTenantLifecycleJobType('speech', 'speech.import')).toBe(false);
  });
});
