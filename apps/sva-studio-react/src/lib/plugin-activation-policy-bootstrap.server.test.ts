import { beforeEach, describe, expect, it, vi } from 'vitest';

const configureMock = vi.fn();
const reconcileMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
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

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: loggerWarnMock, error: loggerErrorMock }),
}));

import {
  ensurePluginActivationPoliciesConfigured,
  resetPluginActivationPolicyBootstrapForTests,
  startPluginActivationPolicyFleetReconcileInBackground,
} from './plugin-activation-policy-bootstrap.server';

beforeEach(() => {
  configureMock.mockReset();
  reconcileMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();
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
    startPluginActivationPolicyFleetReconcileInBackground();

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledWith({
      activationPolicies: snapshot,
      moduleIamContracts: [pluginModuleIamContract, hostModuleIamContract],
      tenantLifecycles: [tenantLifecycle],
    });
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(1));
    expect(reconcileMock).toHaveBeenCalledWith({ revision: 'catalog-1' });
  });

  it('backs off a degraded fleet reconcile before retrying the revision', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
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
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledOnce());
    startPluginActivationPolicyFleetReconcileInBackground();
    await Promise.resolve();
    expect(reconcileMock).toHaveBeenCalledTimes(1);
    now.mockReturnValue(61_000);
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(2));
    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(reconcileMock).toHaveBeenCalledTimes(2);
  });

  it('does not block configuration on the fleet-wide reconcile', async () => {
    let completeReconcile: ((value: { status: 'ready' }) => void) | undefined;
    let reconcileCompleted = false;
    reconcileMock.mockImplementationOnce(() =>
      new Promise<{ status: 'ready' }>((resolve) => {
        completeReconcile = resolve;
      }).then((report) => {
        reconcileCompleted = true;
        return report;
      })
    );

    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledOnce();
    expect(reconcileMock).not.toHaveBeenCalled();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledOnce());
    expect(reconcileCompleted).toBe(false);
    completeReconcile?.({ status: 'ready' });
    await vi.waitFor(() => expect(reconcileCompleted).toBe(true));
  });
});
