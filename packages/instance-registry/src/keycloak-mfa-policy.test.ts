import { describe, expect, it, vi } from 'vitest';
import { processClaimedKeycloakProvisioningRun } from './service-keycloak-execution-worker.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import type { InstanceKeycloakProvisioningRun } from '@sva/core';
const run = {
  id: 'run-1',
  instanceId: 'tenant-a',
  intent: 'provision',
  steps: [
    {
      stepKey: 'queued',
      details: {
        loginMfaOnly: true,
        loginMfaRevision: 2,
        loginMfaMode: 'required',
        clientIds: ['studio', 'ssf'],
      },
    },
  ],
} as unknown as InstanceKeycloakProvisioningRun;
const setup = () => {
  const instance = {
    instanceId: 'tenant-a',
    authRealm: 'realm-a',
    loginMfaRevision: 2,
    loginMfaRunId: 'run-1',
    loginMfaPolicy: { desiredMode: 'required', appliedMode: 'optional', status: 'pending' },
  };
  const repository = {
    getInstanceById: vi.fn(async () => instance),
    verifyLoginMfaPolicy: vi.fn(async () => true),
    appendKeycloakProvisioningStep: vi.fn(),
    updateKeycloakProvisioningRun: vi.fn(),
    appendAuditEvent: vi.fn(),
    getKeycloakProvisioningRun: vi.fn(),
  };
  const reconcileLoginMfa = vi.fn(async () => ({ aligned: true, mode: 'required' as const }));
  return {
    instance,
    repository,
    reconcileLoginMfa,
    deps: { repository, reconcileLoginMfa } as unknown as InstanceRegistryServiceDeps,
  };
};
describe('tenant MFA existing provisioning worker', () => {
  it('verifies provider state before certifying the linked desired revision', async () => {
    const { deps, repository } = setup();
    await processClaimedKeycloakProvisioningRun(deps, run);
    expect(repository.verifyLoginMfaPolicy).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      revision: 2,
      mode: 'required',
      runId: 'run-1',
    });
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: 'succeeded' })
    );
  });
  it('retains the verified mode and reports failed provider reconciliation', async () => {
    const { deps, repository, reconcileLoginMfa } = setup();
    reconcileLoginMfa.mockRejectedValueOnce(new Error('provider_unavailable'));
    await processClaimedKeycloakProvisioningRun(deps, run);
    expect(repository.verifyLoginMfaPolicy).not.toHaveBeenCalled();
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: 'failed' })
    );
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ status: 'failed', runId: 'run-1' }),
      })
    );
  });
  it('never executes a superseded queued request', async () => {
    const { deps, instance, repository, reconcileLoginMfa } = setup();
    instance.loginMfaRevision = 3;
    await processClaimedKeycloakProvisioningRun(deps, run);
    expect(reconcileLoginMfa).not.toHaveBeenCalled();
    expect(repository.verifyLoginMfaPolicy).not.toHaveBeenCalled();
  });
});
