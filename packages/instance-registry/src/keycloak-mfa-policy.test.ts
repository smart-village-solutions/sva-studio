import { describe, expect, it, vi } from 'vitest';
import { appendFinalStatusSnapshot } from './service-keycloak-execution-finalize.js';
import { createGetKeycloakStatusHandler } from './service-keycloak-readers.js';
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
        pluginOidcSnapshotVersion: '1.0',
        pluginOidcClients: [],
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
    authClientId: 'studio',
    realmMode: 'existing',
    primaryHostname: 'tenant-a.example.test',
    loginMfaRevision: 2,
    loginMfaRunId: 'run-1',
    loginMfaPolicy: { desiredMode: 'required', appliedMode: 'optional', status: 'pending' },
  };
  const repository = {
    getInstanceById: vi.fn(async () => instance),
    getAuthClientSecretCiphertext: vi.fn(async () => null),
    listKeycloakProvisioningRuns: vi.fn(async () => [] as InstanceKeycloakProvisioningRun[]),
    verifyLoginMfaPolicy: vi.fn(async () => true),
    appendKeycloakProvisioningStep: vi.fn(),
    updateKeycloakProvisioningRun: vi.fn(),
    appendAuditEvent: vi.fn(),
    getKeycloakProvisioningRun: vi.fn(),
  };
  const providerState = {
    realm: { realm: 'realm-a' },
    clientRepresentation: {
      attributes: { managed_by: 'studio', instance_id: 'tenant-a', artifact_key: 'login_client' },
      redirectUris: [],
      webOrigins: [] as string[],
    },
    expectedClient: { redirectUris: [], postLogoutRedirectUris: [], webOrigins: [] as string[] },
    tenantAdminStatus: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
    pluginOidcClients: [],
    protocolMappers: [],
    loginMfa: { aligned: true, mode: 'required' as 'optional' | 'required' },
  };
  const readKeycloakStateViaProvisioner = vi.fn(async () => providerState);
  const reconcileLoginMfa = vi.fn(async () => ({ aligned: true, mode: 'required' as const }));
  return {
    instance,
    repository,
    reconcileLoginMfa,
    providerState,
    readKeycloakStateViaProvisioner,
    deps: {
      repository,
      reconcileLoginMfa,
      readKeycloakStateViaProvisioner,
      revealSecret: () => undefined,
    } as unknown as InstanceRegistryServiceDeps,
  };
};
describe('tenant MFA existing provisioning worker', () => {
  it.each(['optional', 'required'] as const)(
    'refreshes full status after a %s -> required save and never re-certifies unrelated drift',
    async (previousMode) => {
      const { deps, repository, instance, providerState, readKeycloakStateViaProvisioner } =
        setup();
      const runs: InstanceKeycloakProvisioningRun[] = [];
      repository.listKeycloakProvisioningRuns.mockImplementation(async () => runs);
      repository.appendKeycloakProvisioningStep.mockImplementation(async (step) => {
        let stored = runs.find((item) => item.id === step.runId);
        if (!stored) {
          stored = { ...run, id: step.runId, steps: step.runId === run.id ? [...run.steps] : [] };
          runs.unshift(stored);
        }
        (stored.steps as unknown[]).push(step);
        return step;
      });
      // A valid snapshot exists for the previous mode/revision.
      instance.loginMfaRevision = 1;
      instance.loginMfaPolicy.desiredMode = previousMode;
      providerState.loginMfa.mode = previousMode;
      await appendFinalStatusSnapshot(
        deps,
        { loaded: { instance } as never, runId: 'previous-full', intent: 'provision' },
        instance as never,
        providerState as never,
        false
      );
      const getStatus = createGetKeycloakStatusHandler(deps);
      expect(await getStatus('tenant-a')).toMatchObject({
        realmExists: true,
        clientExists: true,
        webOriginsMatch: true,
        loginMfaAligned: true,
      });
      instance.loginMfaRevision = 2;
      instance.loginMfaPolicy.desiredMode = 'required';
      providerState.loginMfa.mode = 'required';
      // A separate provider setting changed since the earlier snapshot.
      providerState.expectedClient.webOrigins = ['https://tenant-a.example.test'];
      await processClaimedKeycloakProvisioningRun(deps, run);
      expect(readKeycloakStateViaProvisioner).toHaveBeenCalled();
      expect(await getStatus('tenant-a')).toMatchObject({
        realmExists: true,
        clientExists: true,
        loginMfaAligned: true,
        webOriginsMatch: false,
      });
    }
  );

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
  it('does not certify MFA or snapshot status when full independent read-back fails', async () => {
    const { deps, repository, readKeycloakStateViaProvisioner } = setup();
    readKeycloakStateViaProvisioner.mockRejectedValueOnce(new Error('provider_read_unavailable'));
    await processClaimedKeycloakProvisioningRun(deps, run);
    expect(repository.verifyLoginMfaPolicy).not.toHaveBeenCalled();
    expect(repository.appendKeycloakProvisioningStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ stepKey: 'status_snapshot' })
    );
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: 'failed' })
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
