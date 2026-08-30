import { beforeEach, describe, expect, it, vi } from 'vitest';

const configureMock = vi.fn();
const reconcileMock = vi.fn();
const pluginModuleIamContract = {
  moduleId: 'news',
  namespace: 'news',
  ownerPluginId: 'news',
  permissionIds: ['news.read'],
  systemRoles: [{ roleName: 'system_admin', permissionIds: ['news.read'] }],
};
const hostModuleIamContract = {
  moduleId: 'media',
  namespace: 'media',
  ownerPluginId: 'studio-core',
  permissionIds: ['media.read'],
  tenantBootstrapRoles: [],
  rootSystemRoles: [],
};
const snapshot = {
  revision: 'catalog-1',
  modules: [
    {
      moduleId: 'news',
      activationPolicy: 'optional' as const,
      manifestVersion: 1,
      policyRevision: 'news-1',
    },
  ],
};
const tenantLifecycle = {
  pluginId: 'news',
  contractVersion: 1 as const,
  operations: [],
  readinessChecks: [],
};

vi.mock('./plugins', () => ({
  studioHostModuleIamContracts: [hostModuleIamContract],
  studioPluginSnapshot: {
    tenantActivationPolicySnapshot: snapshot,
    registry: {
      pluginModuleIamContracts: [pluginModuleIamContract],
      tenantLifecycles: [tenantLifecycle],
    },
  },
}));

vi.mock('@sva/auth-runtime/server', () => ({
  configureInstanceRegistryPluginRuntimeSnapshot: configureMock,
  reconcileConfiguredPluginActivationPoliciesForAllInstances: reconcileMock,
}));

import {
  ensurePluginActivationPoliciesConfigured,
  resetPluginActivationPolicyBootstrapForTests,
} from './plugin-activation-policy-bootstrap.server';

beforeEach(() => {
  configureMock.mockReset();
  reconcileMock.mockReset();
  reconcileMock.mockResolvedValue({ status: 'ready' });
  resetPluginActivationPolicyBootstrapForTests();
});

describe('plugin activation policy bootstrap', () => {
  it('passes the canonical host snapshot to auth runtime once per revision', async () => {
    await Promise.all([
      ensurePluginActivationPoliciesConfigured(),
      ensurePluginActivationPoliciesConfigured(),
    ]);
    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledWith({
      activationPolicies: snapshot,
      moduleIamContracts: [pluginModuleIamContract, hostModuleIamContract],
      tenantLifecycles: [tenantLifecycle],
    });
    expect(reconcileMock).toHaveBeenCalledTimes(1);
    expect(reconcileMock).toHaveBeenCalledWith({ revision: 'catalog-1' });
  });

  it('retries a degraded fleet reconcile instead of caching the revision', async () => {
    reconcileMock
      .mockResolvedValueOnce({
        status: 'degraded',
        revision: 'catalog-1',
        instanceCount: 1,
        reconciledInstanceCount: 0,
        failures: [
          {
            instanceId: 'tenant-a',
            stage: 'reconcile_instance',
            code: 'plugin_activation_policy_reconcile_failed',
          },
        ],
      })
      .mockResolvedValueOnce({ status: 'ready' });

    await ensurePluginActivationPoliciesConfigured();
    await ensurePluginActivationPoliciesConfigured();
    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledTimes(2);
    expect(reconcileMock).toHaveBeenCalledTimes(2);
  });
});
