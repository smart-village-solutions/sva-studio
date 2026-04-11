import { describe, expect, it, vi } from 'vitest';

import { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';

describe('service-keycloak-run-steps', () => {
  it('appendRunStep keeps pending step without startedAt and finishedAt', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
    };

    await appendRunStep(
      {
        repository: repository as never,
      } as never,
      {
        runId: 'run-1',
        stepKey: 'queued',
        title: 'Queued',
        status: 'pending',
        summary: 'waiting',
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        status: 'pending',
        startedAt: undefined,
        finishedAt: undefined,
      })
    );
  });

  it('appendRunStep sets startedAt for running steps and no finishedAt', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
    };

    await appendRunStep(
      {
        repository: repository as never,
      } as never,
      {
        runId: 'run-2',
        stepKey: 'execution',
        title: 'Run',
        status: 'running',
        summary: 'in progress',
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        status: 'running',
        startedAt: expect.any(String),
        finishedAt: undefined,
      })
    );
  });

  it('appendRunStep sets startedAt and finishedAt for terminal steps', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
    };

    await appendRunStep(
      {
        repository: repository as never,
      } as never,
      {
        runId: 'run-3',
        stepKey: 'execution',
        title: 'Run',
        status: 'failed',
        summary: 'failed',
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-3',
        status: 'failed',
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
      })
    );
  });

  it('buildFinalRunSteps includes temporary-password step for reset_tenant_admin intent', () => {
    const status = {
      realmExists: true,
      clientExists: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      instanceIdMapperExists: true,
      clientSecretAligned: true,
      tenantAdminHasSystemAdmin: true,
      tenantAdminHasInstanceRegistryAdmin: false,
      tenantAdminExists: true,
      tenantAdminInstanceIdMatches: true,
    };

    const steps = buildFinalRunSteps({
      status: status as never,
      intent: 'reset_tenant_admin',
      usedTemporaryPassword: false,
    });

    expect(steps.map((step) => step.stepKey)).toContain('tenant_admin_password');
    expect(steps.find((step) => step.stepKey === 'tenant_admin_password')).toEqual(
      expect.objectContaining({ ok: false })
    );
  });

  it('buildFinalRunSteps reports role mismatch as failed', () => {
    const status = {
      realmExists: true,
      clientExists: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      instanceIdMapperExists: true,
      clientSecretAligned: true,
      tenantAdminHasSystemAdmin: true,
      tenantAdminHasInstanceRegistryAdmin: true,
      tenantAdminExists: true,
      tenantAdminInstanceIdMatches: true,
    };

    const steps = buildFinalRunSteps({
      status: status as never,
      intent: 'provision',
      usedTemporaryPassword: false,
    });

    const rolesStep = steps.find((step) => step.stepKey === 'roles');
    expect(rolesStep).toEqual(
      expect.objectContaining({
        ok: false,
        summary: 'Die Tenant-Admin-Rollen weichen vom Minimalprofil ab.',
      })
    );
  });

  it('buildFinalRunSteps reports tenant_admin attribute mismatch', () => {
    const status = {
      realmExists: true,
      clientExists: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      instanceIdMapperExists: true,
      clientSecretAligned: true,
      tenantAdminHasSystemAdmin: true,
      tenantAdminHasInstanceRegistryAdmin: false,
      tenantAdminExists: true,
      tenantAdminInstanceIdMatches: false,
    };

    const steps = buildFinalRunSteps({
      status: status as never,
      intent: 'provision',
      usedTemporaryPassword: true,
    });

    const tenantAdminStep = steps.find((step) => step.stepKey === 'tenant_admin');
    expect(tenantAdminStep).toEqual(
      expect.objectContaining({
        ok: false,
        summary: 'Der Tenant-Admin ist vorhanden, aber das instanceId-Attribut weicht ab.',
      })
    );

    expect(steps.map((step) => step.stepKey)).toContain('tenant_admin_password');
  });
});
