import { describe, expect, it, vi } from 'vitest';

import {
  buildKeycloakProvisioningPayloadFingerprint,
  buildProvisioningInput,
  createQueuedRun,
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
    expect(fingerprintWithSecret).not.toBe(fingerprintWithoutSecret);
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
});
