import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  areAllRequirementsSatisfied: vi.fn(),
  appendRunStep: vi.fn(),
  buildKeycloakStatus: vi.fn(),
  buildFinalRunSteps: vi.fn(),
  buildMissingRealmStatus: vi.fn(),
  buildPlan: vi.fn(),
  buildPreflightChecks: vi.fn(),
  buildProvisioningInput: vi.fn(),
  toOverallPreflightStatus: vi.fn(),
}));

vi.mock('@sva/core', () => ({
  areAllInstanceKeycloakRequirementsSatisfied: state.areAllRequirementsSatisfied,
  isInstanceTenantAdminRequired: (input: {
    realmMode: 'new' | 'existing';
    tenantAdminBootstrap?: { username: string };
  }) => input.realmMode !== 'existing' || Boolean(input.tenantAdminBootstrap?.username),
}));

vi.mock('./service-keycloak-run-steps.js', () => ({
  appendRunStep: state.appendRunStep,
  buildFinalRunSteps: state.buildFinalRunSteps,
}));

vi.mock('./service-keycloak-execution-payload.js', () => ({
  buildProvisioningInput: state.buildProvisioningInput,
}));

vi.mock('./provisioning-auth-evaluation.js', () => ({
  buildKeycloakStatus: state.buildKeycloakStatus,
  buildMissingRealmStatus: state.buildMissingRealmStatus,
  buildPlan: state.buildPlan,
  buildPreflightChecks: state.buildPreflightChecks,
  toOverallPreflightStatus: state.toOverallPreflightStatus,
}));

describe('service-keycloak-execution-finalize', () => {
  beforeEach(() => {
    vi.resetModules();
    state.areAllRequirementsSatisfied.mockReset();
    state.appendRunStep.mockReset();
    state.buildKeycloakStatus.mockReset();
    state.buildFinalRunSteps.mockReset();
    state.buildMissingRealmStatus.mockReset();
    state.buildPlan.mockReset().mockReturnValue({ overallStatus: 'ready' });
    state.buildPreflightChecks.mockReset().mockReturnValue([]);
    state.buildProvisioningInput.mockReset();
    state.toOverallPreflightStatus.mockReset().mockReturnValue('ready');
  });

  it('throws when the final Keycloak state reader is missing', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');

    await expect(
      completeRun(
        {
          repository: {} as never,
        } as never,
        {
          loaded: {
            instance: {
              instanceId: 'instance-1',
              status: 'draft',
            },
          } as never,
          runId: 'run-1',
          intent: 'provision',
        }
      )
    ).rejects.toThrow('dependency_missing_readKeycloakStateViaProvisioner');
  });

  it('marks successful runs, snapshots the status and updates the instance status', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const { buildKeycloakSnapshotInputFingerprint } = await import('./provisioning-auth-policy.js');
    const status = { realmExists: true };
    const realmUpdated = {
      instanceId: 'instance-1',
      status: 'draft',
      realmMode: 'existing',
      updatedAt: '2026-09-11T10:00:01.000Z',
    };
    const statusUpdated = {
      ...realmUpdated,
      status: 'provisioning',
      updatedAt: '2026-09-11T10:00:02.000Z',
    };
    const repository = {
      setInstanceRealmMode: vi.fn().mockResolvedValue(realmUpdated),
      setInstanceStatus: vi.fn().mockResolvedValue(statusUpdated),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.buildFinalRunSteps.mockReturnValue([
      {
        stepKey: 'roles',
        title: 'Rollen',
        ok: true,
        summary: 'ok',
        details: { scope: 'roles' },
      },
    ]);
    state.areAllRequirementsSatisfied.mockReturnValue(true);
    state.buildKeycloakStatus.mockReturnValue(status);
    state.appendRunStep.mockResolvedValue(undefined);
    const finalState = { realm: { realm: 'demo' } };
    const readKeycloakStateViaProvisioner = vi.fn().mockResolvedValue(finalState);
    const result = await completeRun(
      {
        repository: repository as never,
        readKeycloakStateViaProvisioner,
      } as never,
      {
        loaded: {
          instance: {
            instanceId: 'instance-1',
            status: 'draft',
            realmMode: 'new',
          },
        } as never,
        runId: 'run-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'provision',
        tenantAdminTemporaryPassword: 'temp-secret',
      }
    );

    expect(result).toBe('succeeded');
    expect(readKeycloakStateViaProvisioner).toHaveBeenCalledOnce();
    expect(state.buildKeycloakStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: finalState })
    );
    expect(state.buildPreflightChecks).toHaveBeenCalledWith(
      expect.objectContaining({ state: finalState })
    );
    expect(state.buildPlan).toHaveBeenCalledWith(expect.objectContaining({ state: finalState }));
    expect(state.buildProvisioningInput).toHaveBeenCalled();
    expect(state.appendRunStep).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'status_snapshot',
        status: 'done',
        details: {
          policyVersion: 3,
          inputFingerprint: buildKeycloakSnapshotInputFingerprint(statusUpdated as never),
          status,
          preflight: expect.objectContaining({ overallStatus: 'ready' }),
          plan: { overallStatus: 'ready' },
        },
      })
    );
    expect(state.buildFinalRunSteps).toHaveBeenCalledWith({
      status,
      intent: 'provision',
      usedTemporaryPassword: true,
      requireTenantAdmin: true,
    });
    expect(repository.setInstanceStatus).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      status: 'provisioning',
      actorId: 'actor-1',
      requestId: 'request-1',
    });
    expect(repository.setInstanceRealmMode).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      realmMode: 'existing',
      actorId: 'actor-1',
      requestId: 'request-1',
    });
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith({
      runId: 'run-1',
      overallStatus: 'succeeded',
      driftSummary: 'Provisioning erfolgreich abgeschlossen.',
    });
  });

  it('completes an existing realm repair without an optional bootstrap admin', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const status = {
      realmExists: true,
      systemAdminRoleExists: true,
      tenantAdminExists: false,
      tenantAdminHasSystemAdmin: false,
    };
    const repository = {
      setInstanceStatus: vi.fn(),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };
    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.buildFinalRunSteps.mockReturnValue([
      { stepKey: 'roles', title: 'Rollen', ok: true, summary: 'ok' },
    ]);
    state.areAllRequirementsSatisfied.mockImplementation(
      (candidate, options) =>
        options?.requireTenantAdmin === false ||
        (candidate.tenantAdminExists && candidate.tenantAdminHasSystemAdmin)
    );
    state.buildKeycloakStatus.mockReturnValue(status);
    state.appendRunStep.mockResolvedValue(undefined);

    await expect(
      completeRun(
        {
          repository: repository as never,
          readKeycloakStateViaProvisioner: vi.fn().mockResolvedValue({ realm: { realm: 'demo' } }),
        } as never,
        {
          loaded: {
            instance: {
              instanceId: 'instance-imported',
              status: 'active',
              realmMode: 'existing',
              tenantAdminBootstrap: undefined,
            },
          } as never,
          runId: 'run-role-repair',
          intent: 'provision',
        }
      )
    ).resolves.toBe('succeeded');

    expect(state.buildFinalRunSteps).toHaveBeenCalledWith({
      status,
      intent: 'provision',
      usedTemporaryPassword: false,
      requireTenantAdmin: false,
    });
    expect(state.areAllRequirementsSatisfied).toHaveBeenCalledWith(status, {
      requireTenantAdmin: false,
    });
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: 'succeeded' })
    );
  });

  it('marks failed runs without changing already active instances', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const repository = {
      setInstanceStatus: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.buildFinalRunSteps.mockReturnValue([
      {
        stepKey: 'roles',
        title: 'Rollen',
        ok: false,
        summary: 'drift',
        details: { scope: 'roles' },
      },
    ]);
    state.areAllRequirementsSatisfied.mockReturnValue(false);
    state.buildMissingRealmStatus.mockReturnValue({ realmExists: false });
    state.appendRunStep.mockResolvedValue(undefined);

    const result = await completeRun(
      {
        repository: repository as never,
        readKeycloakStateViaProvisioner: vi.fn().mockResolvedValue({ realm: null }),
      } as never,
      {
        loaded: {
          instance: {
            instanceId: 'instance-2',
            status: 'active',
          },
        } as never,
        runId: 'run-2',
        intent: 'reset_tenant_admin',
      }
    );

    expect(result).toBe('failed');
    expect(repository.setInstanceStatus).not.toHaveBeenCalled();
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith({
      runId: 'run-2',
      overallStatus: 'failed',
      driftSummary: 'Provisioning abgeschlossen, aber einzelne Sollzustände weichen weiterhin ab.',
    });
    expect(state.appendRunStep).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        runId: 'run-2',
        stepKey: 'roles',
        status: 'failed',
      })
    );
  });

  it('does not complete provisioning while an aggregated Keycloak requirement drifts', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const repository = {
      setInstanceRealmMode: vi.fn(),
      setInstanceStatus: vi.fn(),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };
    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.buildFinalRunSteps.mockReturnValue([
      { stepKey: 'status', title: 'Status', ok: true, summary: 'ok' },
    ]);
    state.areAllRequirementsSatisfied.mockReturnValue(false);
    state.buildKeycloakStatus.mockReturnValue({ pluginOidcClientsAligned: false });
    state.appendRunStep.mockResolvedValue(undefined);

    await expect(
      completeRun(
        {
          repository: repository as never,
          readKeycloakStateViaProvisioner: vi.fn().mockResolvedValue({ realm: { realm: 'demo' } }),
        } as never,
        {
          loaded: {
            instance: { instanceId: 'instance-2', status: 'draft', realmMode: 'new' },
          } as never,
          runId: 'run-plugin-drift',
          intent: 'provision',
        }
      )
    ).resolves.toBe('failed');
    expect(repository.setInstanceRealmMode).not.toHaveBeenCalled();
    expect(repository.setInstanceStatus).not.toHaveBeenCalled();
  });

  it('keeps reset_tenant_admin runs successful when unrelated client drift remains', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const status = {
      realmExists: true,
      clientExists: true,
      redirectUrisMatch: false,
      logoutUrisMatch: false,
      webOriginsMatch: false,
      clientSecretAligned: false,
      tenantAdminClientExists: false,
      tenantAdminClientSecretAligned: false,
      tenantAdminHasSystemAdmin: true,
      tenantAdminExists: true,
    };
    const repository = {
      setInstanceRealmMode: vi.fn().mockResolvedValue(undefined),
      setInstanceStatus: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.buildFinalRunSteps.mockReturnValue([
      {
        stepKey: 'realm',
        title: 'Realm bearbeiten',
        ok: true,
        summary: 'ok',
      },
      {
        stepKey: 'roles',
        title: 'Realm-Rollen sicherstellen',
        ok: true,
        summary: 'ok',
      },
      {
        stepKey: 'tenant_admin',
        title: 'Tenant-Admin sicherstellen',
        ok: true,
        summary: 'ok',
      },
      {
        stepKey: 'tenant_admin_password',
        title: 'Temporäres Passwort setzen',
        ok: true,
        summary: 'ok',
      },
    ]);
    state.areAllRequirementsSatisfied.mockReturnValue(false);
    state.buildKeycloakStatus.mockReturnValue(status);
    state.appendRunStep.mockResolvedValue(undefined);

    const result = await completeRun(
      {
        repository: repository as never,
        readKeycloakStateViaProvisioner: vi.fn().mockResolvedValue({ realm: { realm: 'demo' } }),
      } as never,
      {
        loaded: {
          instance: {
            instanceId: 'instance-3',
            status: 'draft',
            realmMode: 'new',
          },
        } as never,
        runId: 'run-3',
        requestId: 'request-3',
        actorId: 'actor-3',
        intent: 'reset_tenant_admin',
        tenantAdminTemporaryPassword: 'tmp-password',
      }
    );

    expect(result).toBe('succeeded');
    expect(repository.setInstanceStatus).toHaveBeenCalledWith({
      instanceId: 'instance-3',
      status: 'provisioning',
      actorId: 'actor-3',
      requestId: 'request-3',
    });
    expect(repository.setInstanceRealmMode).not.toHaveBeenCalled();
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith({
      runId: 'run-3',
      overallStatus: 'succeeded',
      driftSummary: 'Provisioning erfolgreich abgeschlossen.',
    });
  });
});
