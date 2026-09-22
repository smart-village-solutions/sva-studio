import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  buildProvisioningInput: vi.fn(),
  loadRealmBaselineApplicability: vi.fn(),
}));

vi.mock('./service-keycloak-execution-shared.js', () => ({
  buildProvisioningInput: state.buildProvisioningInput,
}));

vi.mock('./service-keycloak-snapshot-reader.js', () => ({
  loadRealmBaselineApplicability: state.loadRealmBaselineApplicability,
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
    state.loadRealmBaselineApplicability.mockReset().mockResolvedValue(false);
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
    const { ensureReconcilePreconditions } =
      await import('./service-keycloak-reconcile-helpers.js');

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

  it('allows reconcile enqueueing when an imported realm only has preflight warnings', async () => {
    const { ensureReconcilePreconditions } =
      await import('./service-keycloak-reconcile-helpers.js');

    await expect(
      ensureReconcilePreconditions(
        {
          getKeycloakPreflight: vi.fn().mockResolvedValue({
            overallStatus: 'warning',
            checks: [{ status: 'warning', summary: 'Kein Bootstrap-Admin konfiguriert.' }],
          }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ready',
            driftSummary: 'Technische Reparatur erforderlich.',
          }),
        } as never,
        createLoaded({
          instance: {
            realmMode: 'existing',
            tenantAdminClient: { clientId: 'tenant-admin' },
          },
          tenantAdminClientSecret: 'secret',
        })
      )
    ).resolves.toBeUndefined();
  });

  it('uses proven Studio baseline applicability for the reconcile precheck plan', async () => {
    const { ensureReconcilePreconditions } =
      await import('./service-keycloak-reconcile-helpers.js');
    const getKeycloakPreflight = vi.fn().mockResolvedValue({
      overallStatus: 'ready',
      checks: [],
    });
    const planKeycloakProvisioning = vi.fn().mockResolvedValue({
      overallStatus: 'ready',
      driftSummary: 'Kein Drift.',
    });
    state.loadRealmBaselineApplicability.mockResolvedValue(true);
    const loaded = createLoaded({
      instance: {
        realmMode: 'existing',
        tenantAdminClient: { clientId: 'tenant-admin' },
      },
      tenantAdminClientSecret: 'secret',
    });

    await ensureReconcilePreconditions(
      {
        repository: {} as never,
        getKeycloakPreflight,
        planKeycloakProvisioning,
      } as never,
      loaded as never
    );

    expect(state.loadRealmBaselineApplicability).toHaveBeenCalledWith(
      expect.anything(),
      loaded.instance
    );
    expect(getKeycloakPreflight).toHaveBeenCalledWith({ payload: 'provisioning' });
    expect(planKeycloakProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({ realmBaselineApplicable: true })
    );
  });

  it('allows secret rotation when tenant_secret is the only blocker', async () => {
    const { ensureReconcilePreconditions } =
      await import('./service-keycloak-reconcile-helpers.js');

    await expect(
      ensureReconcilePreconditions(
        {
          getKeycloakPreflight: vi.fn().mockResolvedValue({
            overallStatus: 'blocked',
            checks: [{ checkKey: 'tenant_secret', status: 'blocked', summary: 'Secret fehlt.' }],
          }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'blocked',
            driftSummary: 'Provisioning blockiert.',
          }),
        } as never,
        createLoaded({ instance: { realmMode: 'existing' } }),
        { allowMissingTenantSecret: true }
      )
    ).resolves.toBeUndefined();
  });
});
