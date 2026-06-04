import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  buildProvisioningInput: vi.fn(),
}));

vi.mock('./service-keycloak-execution-shared.js', () => ({
  buildProvisioningInput: state.buildProvisioningInput,
}));

const createLoaded = (overrides: Record<string, unknown> = {}) => ({
  instance: {
    realmMode: 'new',
    tenantAdminClient: undefined,
  },
  tenantAdminClientSecret: undefined,
  ...overrides,
});

describe('service-keycloak-reconcile-helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    state.buildProvisioningInput.mockReset();
    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
  });

  it('resolves reconcile intents from the rotation flag and tenant-admin client state', async () => {
    const { resolveReconcileIntent } = await import('./service-keycloak-reconcile-helpers.js');

    expect(resolveReconcileIntent(createLoaded(), true)).toBe('rotate_client_secret');
    expect(
      resolveReconcileIntent(
        createLoaded({
          instance: {
            realmMode: 'existing',
            tenantAdminClient: undefined,
          },
        }),
        false
      )
    ).toBe('provision_admin_client');
    expect(
      resolveReconcileIntent(
        createLoaded({
          instance: {
            realmMode: 'existing',
            tenantAdminClient: { clientId: 'tenant-admin' },
          },
        }),
        false
      )
    ).toBe('provision_admin_client');
    expect(
      resolveReconcileIntent(
        createLoaded({
          instance: {
            realmMode: 'existing',
            tenantAdminClient: { clientId: 'tenant-admin' },
          },
          tenantAdminClientSecret: 'secret',
        }),
        false
      )
    ).toBe('provision');
  });

  it('fails closed with the summarized blocker details before reconcile enqueueing', async () => {
    const { ensureReconcilePreconditions } = await import('./service-keycloak-reconcile-helpers.js');

    await expect(
      ensureReconcilePreconditions(
        {
          getKeycloakPreflight: vi.fn().mockResolvedValue({
            overallStatus: 'blocked',
            checks: [
              { status: 'blocked', summary: 'Realm fehlt.' },
              { status: 'ok', summary: 'ignore' },
              { status: 'blocked', summary: 'Client fehlt.' },
            ],
          }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
          }),
        } as never,
        createLoaded()
      )
    ).rejects.toThrow('registry_or_provisioning_drift_blocked:Realm fehlt. Client fehlt.');
  });
});
