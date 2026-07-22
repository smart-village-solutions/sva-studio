import { describe, expect, it, vi } from 'vitest';

import { failClaimedRun, failRun } from './service-keycloak-execution-failures.js';

describe('service-keycloak-execution-failures', () => {
  it('persists failed execution details via failRun', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    await failRun(
      {
        repository: repository as never,
      } as never,
      {
        runId: 'run-1',
        requestId: 'req-1',
        instanceId: 'demo',
        intent: 'reconcile',
        error: new Error('boom'),
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'keycloak_execution',
        status: 'failed',
      })
    );
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        overallStatus: 'failed',
      })
    );
  });

  it('persists worker failure details via failClaimedRun', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    await failClaimedRun(
      {
        repository: repository as never,
      } as never,
      {
        runId: 'run-2',
        requestId: 'req-2',
        instanceId: 'demo',
        intent: 'reconcile',
        summary: 'dependency missing',
        details: { reason: 'dependency_missing' },
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        stepKey: 'worker',
        status: 'failed',
      })
    );
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        driftSummary: 'dependency missing',
      })
    );
  });

  it('classifies missing initial tenant secrets without exposing secret data', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
    };

    await failRun(
      { repository: repository as never } as never,
      {
        runId: 'run-3',
        instanceId: 'demo',
        intent: 'provision',
        error: new Error('tenant_client_secrets_missing_after_provisioning'),
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { reasonCode: 'TENANT_CLIENT_SECRETS_MISSING' },
        summary: 'Die nach dem Provisioning erwarteten Tenant-Client-Secrets sind nicht lesbar.',
      })
    );
  });
});
