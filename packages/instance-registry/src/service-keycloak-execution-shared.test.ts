import { describe, expect, it, vi } from 'vitest';

import {
  buildKeycloakProvisioningPayloadFingerprint,
  buildProvisioningInput,
  createQueuedRun,
  syncProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry,
} from './service-keycloak-execution-shared.js';

const createLoaded = () => ({
  instance: {
    instanceId: 'tenant-a',
    displayName: 'Tenant A',
    parentDomain: 'studio.example.org',
    primaryHostname: 'tenant-a.studio.example.org',
    realmMode: 'existing',
    authRealm: 'tenant-a',
    authClientId: 'studio-client',
    authIssuerUrl: 'https://auth.example.org/realms/tenant-a',
    authClientSecretConfigured: true,
    tenantAdminClient: {
      clientId: 'tenant-admin',
      secretConfigured: true,
    },
    tenantAdminBootstrap: {
      username: 'tenant-admin',
      email: 'tenant-admin@example.invalid',
    },
    themeKey: null,
    featureFlags: {},
    mainserverConfigRef: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  authClientSecret: 'auth-secret',
  tenantAdminClientSecret: 'tenant-admin-secret',
});

describe('service-keycloak-execution-shared', () => {
  it('maps loaded registry state into provisioning input', () => {
    expect(buildProvisioningInput(createLoaded() as never)).toMatchObject({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant-a.studio.example.org',
      realmMode: 'existing',
      authRealm: 'tenant-a',
      authClientId: 'studio-client',
      authClientSecret: 'auth-secret',
      tenantAdminClient: {
        clientId: 'tenant-admin',
        secretConfigured: true,
      },
      tenantAdminClientSecret: 'tenant-admin-secret',
    });
  });

  it('fingerprints stable request fields without deriving the hash from temporary passwords', () => {
    const fingerprintWithSecret = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'executeKeycloakProvisioning',
      intent: 'provision',
      tenantAdminTemporaryPassword: 'first-temporary-password',
    });
    const fingerprintWithDifferentSecret = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'executeKeycloakProvisioning',
      intent: 'provision',
      tenantAdminTemporaryPassword: 'second-temporary-password',
    });
    const fingerprintWithoutSecret = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'executeKeycloakProvisioning',
      intent: 'provision',
    });
    const fingerprintForDifferentIntent = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'executeKeycloakProvisioning',
      intent: 'rotate_client_secret',
      tenantAdminTemporaryPassword: 'first-temporary-password',
    });
    const reconcileWithoutRotation = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'reconcileKeycloak',
      rotateClientSecret: false,
      tenantAdminTemporaryPassword: 'first-temporary-password',
    });
    const reconcileWithRotation = buildKeycloakProvisioningPayloadFingerprint({
      mutation: 'reconcileKeycloak',
      rotateClientSecret: true,
      tenantAdminTemporaryPassword: 'first-temporary-password',
    });

    expect(fingerprintWithSecret).toBe(fingerprintWithDifferentSecret);
    expect(fingerprintWithSecret).toBe(fingerprintWithoutSecret);
    expect(fingerprintWithSecret).not.toBe(fingerprintForDifferentIntent);
    expect(reconcileWithoutRotation).not.toBe(reconcileWithRotation);
  });

  it('creates queued runs with idempotency metadata and encrypted temporary password details', async () => {
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        created: true,
        run: { id: 'run-created' },
      }),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
    };
    const protectSecret = vi.fn((value: string, aad: string) => `protected:${aad}:${value}`);

    const result = await createQueuedRun(
      {
        repository: repository as never,
        protectSecret,
        readPluginOidcClientRequirements: () => [],
      } as never,
      createLoaded() as never,
      {
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-1',
        intent: 'provision',
        actorId: 'actor-1',
        requestId: 'request-1',
        tenantAdminTemporaryPassword: 'temporary-password',
      } as never
    );

    expect(result.run.id).toBe('run-created');
    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-1',
        payloadFingerprint: expect.any(String),
      })
    );
    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-created',
        stepKey: 'queued',
        requestId: 'request-1',
        details: expect.objectContaining({
          intent: 'provision',
          tenantAdminTemporaryPasswordCiphertext:
            'protected:iam.instances.keycloak_run_temp_password:run-created:temporary-password',
        }),
      })
    );
  });

  it('returns replayed queued runs without appending a duplicate queued step', async () => {
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        created: false,
        run: { id: 'run-replayed', steps: [{ stepKey: 'queued' }] },
      }),
      appendKeycloakProvisioningStep: vi.fn(),
    };

    await expect(
      createQueuedRun(
        {
          repository: repository as never,
          readPluginOidcClientRequirements: () => [],
        } as never,
        createLoaded() as never,
        {
          mutation: 'reconcileKeycloak',
          idempotencyKey: 'idem-1',
          intent: 'reconcile',
          actorId: 'actor-1',
          requestId: 'request-1',
          rotateClientSecret: false,
        } as never
      )
    ).resolves.toMatchObject({
      run: { id: 'run-replayed' },
    });
    expect(repository.appendKeycloakProvisioningStep).not.toHaveBeenCalled();
  });

  it('re-syncs actual Keycloak secrets back into the registry when stored secrets drift', async () => {
    const loaded = createLoaded() as never;
    const repository = {
      updateInstanceKeycloakSecrets: vi.fn(async () => ({
        ...createLoaded().instance,
        updatedAt: '2026-01-01T00:00:01.000Z',
      })),
    };
    const readKeycloakClientSecretsViaProvisioner = vi.fn(async () => ({
      keycloakClientSecret: 'actual-auth-secret',
      tenantAdminClientSecret: 'actual-tenant-admin-secret',
    }));
    const readKeycloakStateViaProvisioner = vi.fn();
    const protectSecret = vi.fn((value: string, aad: string) => `protected:${aad}:${value}`);

    await syncProvisionedClientSecretToRegistry(
      {
        repository: repository as never,
        readKeycloakClientSecretsViaProvisioner,
        readKeycloakStateViaProvisioner,
        protectSecret,
      } as never,
      {
        loaded,
        requestId: 'request-1',
        actorId: 'actor-1',
      }
    );

    expect(readKeycloakClientSecretsViaProvisioner).toHaveBeenCalledTimes(1);
    expect(readKeycloakStateViaProvisioner).not.toHaveBeenCalled();
    expect(repository.updateInstanceKeycloakSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        authClientSecretCiphertext:
          'protected:iam.instances.auth_client_secret:tenant-a:actual-auth-secret',
        tenantAdminClientSecretCiphertext:
          'protected:iam.instances.tenant_admin_client_secret:tenant-a:actual-tenant-admin-secret',
        keepExistingAuthClientSecret: false,
        keepExistingTenantAdminClientSecret: false,
      })
    );
  });

  it('keeps provisioned client secrets untouched when no drift exists', async () => {
    const loaded = createLoaded() as never;
    const repository = {
      updateInstanceKeycloakSecrets: vi.fn(async () => undefined),
    };
    const readKeycloakClientSecretsViaProvisioner = vi.fn(async () => ({
      keycloakClientSecret: 'auth-secret',
      tenantAdminClientSecret: 'tenant-admin-secret',
    }));
    const readKeycloakStateViaProvisioner = vi.fn();

    await syncProvisionedClientSecretToRegistry(
      {
        repository: repository as never,
        readKeycloakClientSecretsViaProvisioner,
        readKeycloakStateViaProvisioner,
      } as never,
      {
        loaded,
      }
    );

    expect(repository.updateInstanceKeycloakSecrets).not.toHaveBeenCalled();
    expect(readKeycloakStateViaProvisioner).not.toHaveBeenCalled();
  });

  it('rejects a new realm when Keycloak secrets cannot be read after provisioning', async () => {
    const loaded = createLoaded();
    loaded.instance.realmMode = 'new';
    const repository = { updateInstanceKeycloakSecrets: vi.fn(async () => undefined) };

    await expect(
      syncProvisionedClientSecretToRegistry(
        {
          repository: repository as never,
          readKeycloakClientSecretsViaProvisioner: vi.fn(async () => ({})),
          waitForProvisionedSecretRead: vi.fn(async () => undefined),
          protectSecret: vi.fn(),
        } as never,
        { loaded: loaded as never }
      )
    ).rejects.toThrow('tenant_client_secrets_missing_after_provisioning');

    expect(repository.updateInstanceKeycloakSecrets).not.toHaveBeenCalled();
  });

  it('retries reading newly provisioned secrets before persisting them', async () => {
    const loaded = createLoaded();
    loaded.instance.realmMode = 'new';
    loaded.authClientSecret = undefined;
    loaded.tenantAdminClientSecret = undefined;
    const repository = {
      updateInstanceKeycloakSecrets: vi.fn(async () => ({
        ...createLoaded().instance,
        realmMode: 'new' as const,
        updatedAt: '2026-01-01T00:00:01.000Z',
      })),
    };
    const readKeycloakClientSecretsViaProvisioner = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValue({
        keycloakClientSecret: 'actual-auth-secret',
        tenantAdminClientSecret: 'actual-tenant-admin-secret',
      });
    const waitForProvisionedSecretRead = vi.fn(async () => undefined);

    await syncProvisionedClientSecretToRegistry(
      {
        repository: repository as never,
        readKeycloakClientSecretsViaProvisioner,
        waitForProvisionedSecretRead,
        protectSecret: vi.fn((value: string) => `protected:${value}`),
      } as never,
      { loaded: loaded as never }
    );

    expect(readKeycloakClientSecretsViaProvisioner).toHaveBeenCalledTimes(2);
    expect(waitForProvisionedSecretRead).toHaveBeenCalledWith(100);
    expect(repository.updateInstanceKeycloakSecrets).toHaveBeenCalledTimes(1);
  });

  it('syncs rotated client secrets back into the registry', async () => {
    const loaded = createLoaded() as never;
    const repository = {
      updateInstanceKeycloakSecrets: vi.fn(async () => ({
        ...createLoaded().instance,
        updatedAt: '2026-01-01T00:00:01.000Z',
      })),
    };
    const readKeycloakClientSecretsViaProvisioner = vi.fn(async () => ({
      keycloakClientSecret: 'actual-auth-secret',
      tenantAdminClientSecret: 'actual-tenant-admin-secret',
    }));
    const protectSecret = vi.fn((value: string, aad: string) => `protected:${aad}:${value}`);

    await syncRotatedClientSecretToRegistry(
      {
        repository: repository as never,
        readKeycloakClientSecretsViaProvisioner,
        protectSecret,
      } as never,
      {
        loaded,
        requestId: 'request-1',
        actorId: 'actor-1',
      }
    );

    expect(repository.updateInstanceKeycloakSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        authClientSecretCiphertext:
          'protected:iam.instances.auth_client_secret:tenant-a:actual-auth-secret',
        tenantAdminClientSecretCiphertext:
          'protected:iam.instances.tenant_admin_client_secret:tenant-a:actual-tenant-admin-secret',
        keepExistingAuthClientSecret: false,
      })
    );
    expect(loaded.authClientSecret).toBe('actual-auth-secret');
    expect(loaded.tenantAdminClientSecret).toBe('actual-tenant-admin-secret');
    expect(readKeycloakClientSecretsViaProvisioner).toHaveBeenCalledTimes(1);
  });
});
