import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  areAllRequirementsSatisfied: vi.fn(),
  appendRunStep: vi.fn(),
  buildFinalRunSteps: vi.fn(),
  buildProvisioningInput: vi.fn(),
}));

vi.mock('@sva/core', () => ({
  areAllInstanceKeycloakRequirementsSatisfied: state.areAllRequirementsSatisfied,
}));

vi.mock('./service-keycloak-run-steps.js', () => ({
  appendRunStep: state.appendRunStep,
  buildFinalRunSteps: state.buildFinalRunSteps,
}));

vi.mock('./service-keycloak-execution-payload.js', () => ({
  buildProvisioningInput: state.buildProvisioningInput,
}));

describe('service-keycloak-execution-finalize', () => {
  beforeEach(() => {
    vi.resetModules();
    state.areAllRequirementsSatisfied.mockReset();
    state.appendRunStep.mockReset();
    state.buildFinalRunSteps.mockReset();
    state.buildProvisioningInput.mockReset();
  });

  it('throws when getKeycloakStatus is missing', async () => {
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
    ).rejects.toThrow('dependency_missing_getKeycloakStatus');
  });

  it('marks successful runs, snapshots the status and updates the instance status', async () => {
    const { completeRun } = await import('./service-keycloak-execution-finalize.js');
    const status = { realmExists: true };
    const repository = {
      setInstanceRealmMode: vi.fn().mockResolvedValue(undefined),
      setInstanceStatus: vi.fn().mockResolvedValue(undefined),
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
    state.appendRunStep.mockResolvedValue(undefined);

    const result = await completeRun(
      {
        repository: repository as never,
        getKeycloakStatus: vi.fn().mockResolvedValue(status),
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
    expect(state.buildProvisioningInput).toHaveBeenCalled();
    expect(state.appendRunStep).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'status_snapshot',
        status: 'done',
        details: { status },
      })
    );
    expect(state.buildFinalRunSteps).toHaveBeenCalledWith({
      status,
      intent: 'provision',
      usedTemporaryPassword: true,
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
    state.appendRunStep.mockResolvedValue(undefined);

    const result = await completeRun(
      {
        repository: repository as never,
        getKeycloakStatus: vi.fn().mockResolvedValue({ realmExists: false }),
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
    state.appendRunStep.mockResolvedValue(undefined);

    const result = await completeRun(
      {
        repository: repository as never,
        getKeycloakStatus: vi.fn().mockResolvedValue(status),
      } as never,
      {
        loaded: {
          instance: {
            instanceId: 'instance-3',
            status: 'draft',
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
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith({
      runId: 'run-3',
      overallStatus: 'succeeded',
      driftSummary: 'Provisioning erfolgreich abgeschlossen.',
    });
  });
});
