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

it.each([
  'missing instance',
  'different linked run',
  'different desired mode',
  'invalid client list',
  'invalid client ID',
] as const)('rejects %s before calling the provider', async (problem) => {
  const { deps, repository, instance, reconcileLoginMfa } = setup();
  const queuedRun = {
    ...run,
    steps: run.steps.map((step) => ({ ...step, details: { ...step.details } })),
  };
  if (problem === 'missing instance')
    repository.getInstanceById.mockResolvedValueOnce(null as never);
  if (problem === 'different linked run') instance.loginMfaRunId = 'newer-run';
  if (problem === 'different desired mode') instance.loginMfaPolicy.desiredMode = 'optional';
  if (problem === 'invalid client list') queuedRun.steps[0].details.clientIds = 'studio';
  if (problem === 'invalid client ID') queuedRun.steps[0].details.clientIds = ['studio', 7];
  await processClaimedKeycloakProvisioningRun(deps, queuedRun);
  expect(reconcileLoginMfa).not.toHaveBeenCalled();
  expect(repository.verifyLoginMfaPolicy).not.toHaveBeenCalled();
  expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
    expect.objectContaining({ overallStatus: 'failed' })
  );
});
it.each([
  'reconcile missing',
  'full read missing',
  'unaligned reconcile',
  'wrong reconciled mode',
  'unaligned full state',
  'wrong full mode',
  'removed before full read',
  'failed CAS',
] as const)('does not publish verification or a status snapshot after %s', async (problem) => {
  const { deps, repository, instance, providerState, reconcileLoginMfa } = setup();
  if (problem === 'reconcile missing')
    delete (deps as { reconcileLoginMfa?: unknown }).reconcileLoginMfa;
  if (problem === 'full read missing')
    delete (deps as { readKeycloakStateViaProvisioner?: unknown }).readKeycloakStateViaProvisioner;
  if (problem === 'unaligned reconcile')
    reconcileLoginMfa.mockResolvedValueOnce({ aligned: false, mode: 'required' });
  if (problem === 'wrong reconciled mode')
    reconcileLoginMfa.mockResolvedValueOnce({ aligned: true, mode: 'optional' } as never);
  if (problem === 'unaligned full state') providerState.loginMfa.aligned = false;
  if (problem === 'wrong full mode') providerState.loginMfa.mode = 'optional';
  if (problem === 'removed before full read')
    repository.getInstanceById.mockResolvedValueOnce(instance).mockResolvedValueOnce(null as never);
  if (problem === 'failed CAS') repository.verifyLoginMfaPolicy.mockResolvedValueOnce(false);
  await processClaimedKeycloakProvisioningRun(deps, run);
  expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
    expect.objectContaining({ overallStatus: 'failed' })
  );
  expect(repository.appendKeycloakProvisioningStep).not.toHaveBeenCalledWith(
    expect.objectContaining({ stepKey: 'status_snapshot' })
  );
  expect(repository.appendAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      details: expect.objectContaining({ status: 'failed', runId: 'run-1' }),
    })
  );
  expect(repository.appendAuditEvent).not.toHaveBeenCalledWith(
    expect.objectContaining({ details: expect.objectContaining({ status: 'applied' }) })
  );
  if (problem !== 'failed CAS') expect(repository.verifyLoginMfaPolicy).not.toHaveBeenCalled();
});

import { createUpdateLoginMfaPolicy, processLoginMfaRun } from './service-login-mfa.js';

it('fails a malformed queued request with no snapshot without invoking provider operations', async () => {
  const { deps, repository, reconcileLoginMfa } = setup();
  await processLoginMfaRun(deps, { ...run, steps: [] });
  expect(reconcileLoginMfa).not.toHaveBeenCalled();
  expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
    expect.objectContaining({ overallStatus: 'failed' })
  );
});

it.each(['optional', 'required'] as const)(
  'queues an audited %s revision with only supported browser clients',
  async (mode) => {
    const { deps, repository, instance, reconcileLoginMfa } = setup();
    instance.loginMfaPolicy.desiredMode = mode;
    const createRun = vi.fn(async () => ({ run }));
    const bindRun = vi.fn();
    const updatePolicy = vi.fn(async () => instance);
    Object.assign(repository, {
      updateLoginMfaPolicy: updatePolicy,
      createKeycloakProvisioningRun: createRun,
      bindLoginMfaRun: bindRun,
    });
    Object.assign(deps, {
      readPluginOidcClientRequirements: () => [
        { contractVersion: '1.0', clientId: 'service-only', pluginId: 'old' },
        { contractVersion: '2.0', clientId: 'ssf', pluginId: 'ssf' },
      ],
    });
    const input = {
      instanceId: 'tenant-a',
      mode,
      expectedRevision: 1,
      actorId: 'actor',
      requestId: 'request',
    };
    const result = await createUpdateLoginMfaPolicy(deps)(input);
    expect(updatePolicy).toHaveBeenCalledWith(input);
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        idempotencyKey: 'login-mfa:2',
        overallStatus: 'planned',
      })
    );
    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        stepKey: 'queued',
        details: expect.objectContaining({
          clientIds: ['studio', 'ssf'],
          loginMfaMode: mode,
          loginMfaRevision: 2,
        }),
      })
    );
    expect(bindRun).toHaveBeenCalledWith({ instanceId: 'tenant-a', revision: 2, runId: 'run-1' });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          desiredMode: mode,
          appliedMode: 'optional',
          status: 'pending',
        }),
      })
    );
    expect(result).toEqual({
      policy: { desiredMode: mode, appliedMode: 'optional', status: 'pending' },
      revision: 2,
      runId: 'run-1',
    });
    expect(reconcileLoginMfa).not.toHaveBeenCalled();
  }
);

it('does not enqueue an incomplete client snapshot when the required registry dependency is absent', async () => {
  const { deps, repository, instance } = setup();
  const createRun = vi.fn();
  Object.assign(repository, {
    updateLoginMfaPolicy: vi.fn(async () => instance),
    createKeycloakProvisioningRun: createRun,
  });
  await expect(
    createUpdateLoginMfaPolicy(deps)({
      instanceId: 'tenant-a',
      mode: 'required',
      expectedRevision: 1,
      actorId: 'actor',
    })
  ).rejects.toThrow('plugin_oidc_client_requirements_dependency_missing');
  expect(createRun).not.toHaveBeenCalled();
});
