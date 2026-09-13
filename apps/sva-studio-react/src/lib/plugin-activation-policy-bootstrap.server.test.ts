import { beforeEach, describe, expect, it, vi } from 'vitest';

const configureMock = vi.fn();
const reconcileMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const pluginSources: { pluginId: string }[] = [];
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
    pluginSources,
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
  createSdkLogger: () => ({
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  }),
}));

import {
  ensurePluginActivationPoliciesConfigured,
  resetPluginActivationPolicyBootstrapForTests,
  startPluginActivationPolicyFleetReconcileInBackground,
} from './plugin-activation-policy-bootstrap.server';

beforeEach(() => {
  vi.unstubAllEnvs();
  configureMock.mockReset();
  reconcileMock.mockReset();
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();
  pluginSources.splice(0, pluginSources.length, { pluginId: 'news' });
  snapshot.revision = 'catalog-1';
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
      pluginOidcClientRequirements: [],
      tenantLifecycles: [tenantLifecycle],
    });
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(1));
    expect(reconcileMock).toHaveBeenCalledWith({ revision: 'catalog-1' });
  });

  it('derives SSF OIDC requirements only from the loaded host plugin sources', async () => {
    pluginSources.push({ pluginId: 'ssf' });

    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginOidcClientRequirements: [
          expect.objectContaining({ pluginId: 'ssf', clientId: 'ssf' }),
        ],
      })
    );
  });

  it('invalidates the fleet revision when the configured SSF login origin changes', async () => {
    pluginSources.push({ pluginId: 'ssf' });
    vi.stubEnv('SVA_STUDIO_SSF_LOGIN_ORIGIN', 'https://dialog-a.example.org');
    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(1));
    const firstRevision = reconcileMock.mock.calls[0]?.[0].revision;

    vi.stubEnv('SVA_STUDIO_SSF_LOGIN_ORIGIN', 'https://dialog-b.example.org');
    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();

    expect(configureMock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(2));
    expect(reconcileMock.mock.calls[1]?.[0].revision).toMatch(/^catalog-1:oidc:[a-f0-9]{64}$/u);
    expect(reconcileMock.mock.calls[1]?.[0].revision).not.toBe(firstRevision);
  });

  it('backs off identical retryable failures and logs one recovery', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
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
            reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
            retryClass: 'retryable',
          },
        ],
      })
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
            reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
            retryClass: 'retryable',
          },
        ],
      })
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
            reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
            retryClass: 'retryable',
          },
        ],
      })
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
            reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
            retryClass: 'retryable',
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
    const firstRetry = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000);
    expect(firstRetry).toBeDefined();
    (firstRetry?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledTimes(2));

    const secondRetry = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 300_000);
    expect(secondRetry).toBeDefined();
    (secondRetry?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledTimes(3));

    const cappedRetries = () => setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 900_000);
    await vi.waitFor(() => expect(cappedRetries()).toHaveLength(1));
    (cappedRetries()[0]?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(4));
    expect(loggerWarnMock).toHaveBeenCalledTimes(3);

    await vi.waitFor(() => expect(cappedRetries()).toHaveLength(2));
    (cappedRetries()[1]?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(5));
    await vi.waitFor(() => expect(loggerInfoMock).toHaveBeenCalledOnce());
    await ensurePluginActivationPoliciesConfigured();

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(reconcileMock).toHaveBeenCalledTimes(5);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Plugin activation policy fleet reconcile recovered',
      expect.objectContaining({
        previous_retry_class: 'retryable',
        previous_reason_codes: ['plugin_tenant_lifecycle_schedule_exhausted'],
      })
    );
    setTimeoutSpy.mockRestore();
  });

  it('checks an identical degraded failure every 30 minutes without repeated warnings', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const degradedReport = {
      status: 'degraded',
      revision: 'catalog-1',
      instanceCount: 1,
      reconciledInstanceCount: 0,
      failures: [
        {
          instanceId: 'tenant-a',
          stage: 'reconcile_instance',
          code: 'plugin_activation_policy_reconcile_failed',
          reasonCode: 'plugin_activation_state_conflict',
          retryClass: 'degraded',
        },
      ],
    };
    reconcileMock
      .mockResolvedValueOnce(degradedReport)
      .mockResolvedValueOnce(degradedReport)
      .mockResolvedValueOnce({ status: 'ready' });

    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledOnce());

    const degradedRetries = () =>
      setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 1_800_000);
    (degradedRetries()[0]?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(2));
    expect(loggerWarnMock).toHaveBeenCalledOnce();

    await vi.waitFor(() => expect(degradedRetries()).toHaveLength(2));
    (degradedRetries()[1]?.[0] as () => void)();
    await vi.waitFor(() => expect(loggerInfoMock).toHaveBeenCalledOnce());

    expect(loggerWarnMock).toHaveBeenCalledOnce();
    setTimeoutSpy.mockRestore();
  });

  it('resets retry backoff when the configured revision changes', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const retryableReport = {
      status: 'degraded',
      revision: 'catalog-1',
      instanceCount: 1,
      reconciledInstanceCount: 0,
      failures: [
        {
          instanceId: 'tenant-a',
          stage: 'reconcile_instance',
          code: 'plugin_activation_policy_reconcile_failed',
          reasonCode: 'plugin_tenant_lifecycle_schedule_exhausted',
          retryClass: 'retryable',
        },
      ],
    };
    reconcileMock.mockResolvedValueOnce(retryableReport).mockResolvedValueOnce({
      ...retryableReport,
      revision: 'catalog-2',
    });

    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledOnce());

    snapshot.revision = 'catalog-2';
    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(loggerWarnMock).toHaveBeenCalledTimes(2));

    expect(setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 60_000)).toHaveLength(2);
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 300_000)).toBe(false);
    setTimeoutSpy.mockRestore();
  });

  it('schedules an autonomous retry after an unexpected fleet reconcile failure', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    reconcileMock
      .mockRejectedValueOnce(new TypeError('database unavailable'))
      .mockResolvedValueOnce({ status: 'ready' });

    await ensurePluginActivationPoliciesConfigured();
    startPluginActivationPolicyFleetReconcileInBackground();
    await vi.waitFor(() => expect(loggerErrorMock).toHaveBeenCalledOnce());

    const retryTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000);
    expect(retryTimer).toBeDefined();
    (retryTimer?.[0] as () => void)();
    await vi.waitFor(() => expect(reconcileMock).toHaveBeenCalledTimes(2));

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Plugin activation policy fleet reconcile failed unexpectedly',
      expect.objectContaining({ revision: 'catalog-1', error_type: 'TypeError' })
    );
    setTimeoutSpy.mockRestore();
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
