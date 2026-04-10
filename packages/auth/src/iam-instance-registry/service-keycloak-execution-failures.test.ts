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
        error: new Error('boom'),
      }
    );

    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'execution',
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
});
