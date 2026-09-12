import { describe, expect, it, vi } from 'vitest';

import {
  createQueuedRun,
  readQueuedPluginOidcClientRequirements,
} from './service-keycloak-execution-payload.js';

const loaded = {
  instance: {
    instanceId: 'tenant-kassel',
    primaryHostname: 'studio.dialog.kassel.de',
    realmMode: 'existing' as const,
    authRealm: 'smartcity',
    authClientId: 'studio-client',
    authClientSecretConfigured: true,
  },
  authClientSecret: 'secret',
  tenantAdminClientSecret: undefined,
};

const ssfRequirement = {
  contractVersion: '1.0' as const,
  pluginId: 'ssf',
  clientId: 'ssf',
  audience: 'ssf',
  enabled: false as const,
};

describe('service-keycloak-execution-payload', () => {
  it('persists the app plugin OIDC snapshot with the queued provisioning run', async () => {
    const appendKeycloakProvisioningStep = vi.fn().mockResolvedValue(undefined);
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        run: { id: 'run-1' },
        created: true,
      }),
      appendKeycloakProvisioningStep,
    };

    await createQueuedRun(
      {
        repository,
        invalidateHost: vi.fn(),
        readPluginOidcClientRequirements: () => [ssfRequirement],
      } as never,
      loaded as never,
      {
        mutation: 'reconcileKeycloak',
        instanceId: 'tenant-kassel',
        idempotencyKey: 'request-1',
        actorId: 'root',
        requestId: 'request-1',
        intent: 'reconcile',
      } as never
    );

    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledOnce();
    expect(appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        stepKey: 'queued',
        details: expect.objectContaining({
          pluginOidcSnapshotVersion: '1.0',
          pluginOidcClients: [ssfRequirement],
        }),
      })
    );
  });

  it('reads versioned snapshots, preserves pre-snapshot jobs, and rejects incomplete snapshots', () => {
    const provisioningInput = {
      ...loaded.instance,
      authClientSecret: loaded.authClientSecret,
    };

    expect(
      readQueuedPluginOidcClientRequirements(
        { pluginOidcSnapshotVersion: '1.0', pluginOidcClients: [ssfRequirement] },
        provisioningInput
      )
    ).toEqual([ssfRequirement]);
    expect(() =>
      readQueuedPluginOidcClientRequirements(
        { pluginOidcSnapshotVersion: '1.0' },
        provisioningInput
      )
    ).toThrow('queued_plugin_oidc_client_requirements_missing_or_invalid');
    expect(
      readQueuedPluginOidcClientRequirements({ intent: 'reconcile' }, provisioningInput)
    ).toEqual([]);
    expect(() => readQueuedPluginOidcClientRequirements(undefined, provisioningInput)).toThrow(
      'queued_plugin_oidc_client_requirements_missing_or_invalid'
    );
  });

  it('rejects a newly created run when the app snapshot dependency is not wired', async () => {
    const appendKeycloakProvisioningStep = vi.fn();
    const createKeycloakProvisioningRun = vi.fn().mockResolvedValue({
      run: { id: 'run-2' },
      created: true,
    });
    await expect(
      createQueuedRun(
        {
          repository: {
            createKeycloakProvisioningRun,
            appendKeycloakProvisioningStep,
          },
          invalidateHost: vi.fn(),
        } as never,
        loaded as never,
        {
          mutation: 'reconcileKeycloak',
          instanceId: 'tenant-kassel',
          idempotencyKey: 'request-2',
          actorId: 'root',
          requestId: 'request-2',
          intent: 'reconcile',
        } as never
      )
    ).rejects.toThrow('plugin_oidc_client_requirements_dependency_missing');
    expect(createKeycloakProvisioningRun).toHaveBeenCalledOnce();
    expect(appendKeycloakProvisioningStep).not.toHaveBeenCalled();
  });

  it('replays an existing queued run without reading mutable app requirements', async () => {
    const appendKeycloakProvisioningStep = vi.fn();
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        run: { id: 'run-1', steps: [{ stepKey: 'queued' }] },
        created: false,
      }),
      appendKeycloakProvisioningStep,
    };

    await expect(
      createQueuedRun(
        { repository, invalidateHost: vi.fn() } as never,
        loaded as never,
        {
          mutation: 'reconcileKeycloak',
          instanceId: 'tenant-kassel',
          idempotencyKey: 'request-1',
          actorId: 'root',
          requestId: 'request-1',
          intent: 'reconcile',
        } as never
      )
    ).resolves.toMatchObject({ run: { id: 'run-1' } });

    expect(appendKeycloakProvisioningStep).not.toHaveBeenCalled();
  });

  it('repairs an existing planned run whose queued step was not persisted', async () => {
    const appendKeycloakProvisioningStep = vi.fn().mockResolvedValue(undefined);
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        run: { id: 'run-1', overallStatus: 'planned', steps: [] },
        created: false,
      }),
      appendKeycloakProvisioningStep,
    };

    await createQueuedRun(
      {
        repository,
        invalidateHost: vi.fn(),
        readPluginOidcClientRequirements: () => [ssfRequirement],
      } as never,
      loaded as never,
      {
        mutation: 'reconcileKeycloak',
        instanceId: 'tenant-kassel',
        idempotencyKey: 'request-1',
        actorId: 'root',
        requestId: 'request-1',
        intent: 'reconcile',
      } as never
    );

    expect(appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'queued',
        details: expect.objectContaining({ pluginOidcSnapshotVersion: '1.0' }),
      })
    );
  });

  it('propagates a queued snapshot persistence failure to the surrounding transaction', async () => {
    const appendError = new Error('database unavailable');
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        run: { id: 'run-3' },
        created: true,
      }),
      appendKeycloakProvisioningStep: vi.fn().mockRejectedValue(appendError),
    };

    await expect(
      createQueuedRun(
        {
          repository,
          invalidateHost: vi.fn(),
          readPluginOidcClientRequirements: () => [ssfRequirement],
        } as never,
        loaded as never,
        {
          mutation: 'reconcileKeycloak',
          instanceId: 'tenant-kassel',
          idempotencyKey: 'request-3',
          actorId: 'root',
          requestId: 'request-3',
          intent: 'reconcile',
        } as never
      )
    ).rejects.toBe(appendError);
  });
});

it('keeps the browser origin bound to the serialized queue snapshot', () => {
  const browser = {
    contractVersion: '2.0',
    pluginId: 'ssf',
    clientId: 'ssf-frontend',
    audience: 'ssf-frontend',
    enabled: false,
    redirectUris: ['https://dialog.example.org/login/*'],
    webOrigins: ['https://dialog.example.org'],
  };
  const details = JSON.parse(
    JSON.stringify({
      pluginOidcSnapshotVersion: '1.0',
      pluginOidcClients: [ssfRequirement, browser],
    })
  );
  const result = readQueuedPluginOidcClientRequirements(details, loaded.instance);
  expect(result).toEqual([ssfRequirement, browser]);
  details.pluginOidcClients[1].webOrigins = ['*'];
  expect(() => readQueuedPluginOidcClientRequirements(details, loaded.instance)).toThrow(
    'plugin_oidc_client_requirement_invalid'
  );
});
