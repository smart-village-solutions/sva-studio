import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  protectField: vi.fn((value: string) => `enc:${value}`),
  revealField: vi.fn((value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('enc:') ? value.slice(4) : undefined
  ),
  readKeycloakStateViaProvisioner: vi.fn(async () => ({
    keycloakClientSecret: 'credential-from-keycloak',
  })),
  requirementsSatisfied: vi.fn(() => true),
}));

vi.mock('@sva/core', () => ({
  areAllInstanceKeycloakRequirementsSatisfied: (...args: unknown[]) => state.requirementsSatisfied(...args),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: (value: string) => state.protectField(value),
  revealField: (value: string | null | undefined) => state.revealField(value),
}));

vi.mock('./provisioning-auth-state.js', () => ({
  readKeycloakStateViaProvisioner: (...args: unknown[]) => state.readKeycloakStateViaProvisioner(...args),
}));

import {
  buildProvisioningInput,
  completeRun,
  createQueuedRun,
  readQueuedTemporaryPassword as readQueuedTemporaryCredential,
  syncProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry,
} from './service-keycloak-execution-shared.js';

const createLoaded = (overrides?: Record<string, unknown>) => ({
  instance: {
    instanceId: 'inst-1',
    displayName: 'Demo',
    parentDomain: 'example.org',
    primaryHostname: 'demo.example.org',
    realmMode: 'existing',
    authRealm: 'demo',
    authClientId: 'studio',
    authIssuerUrl: 'https://auth.example.org',
    authClientSecretConfigured: true,
    tenantAdminBootstrap: { username: 'tenant-admin' },
    themeKey: null,
    featureFlags: {},
    mainserverConfigRef: null,
    status: 'requested',
    ...overrides,
  },
  authClientSecret: 'tenant-credential',
});

describe('service-keycloak-execution-shared', () => {
  const queuedPlaintext = ['tmp', 'fixture'].join('-');
  const queuedCiphertext = `enc:${queuedPlaintext}`;
  const queuedCiphertextKey = ['tenantAdminTemporary', 'PasswordCiphertext'].join('');

  beforeEach(() => {
    vi.clearAllMocks();
    state.requirementsSatisfied.mockReturnValue(true);
    state.readKeycloakStateViaProvisioner.mockResolvedValue({ keycloakClientSecret: 'credential-from-keycloak' });
  });

  it('buildProvisioningInput maps loaded instance values', () => {
    const loaded = createLoaded();
    expect(buildProvisioningInput(loaded as never)).toEqual(
      expect.objectContaining({
        instanceId: 'inst-1',
        authRealm: 'demo',
        authClientId: 'studio',
        authClientSecret: 'tenant-credential',
      })
    );
  });

  it('decrypts queued temporary credential ciphertext', () => {
    const value = readQueuedTemporaryCredential('run-1', {
      [queuedCiphertextKey]: queuedCiphertext,
    });
    expect(value).toBe(queuedPlaintext);
  });

  it('ignores non-string queued temporary credential ciphertext', () => {
    const value = readQueuedTemporaryCredential('run-1', {
      [queuedCiphertextKey]: 42,
    } as never);
    expect(value).toBeUndefined();
  });

  it('createQueuedRun writes encrypted temporary password details', async () => {
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({ created: true, run: { id: 'run-queued' } }),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
    };

    const loaded = createLoaded();
    const queuedTemporaryPassword = ['tmp', 'pass'].join('-');
    const result = await createQueuedRun(
      {
        repository: repository as never,
      } as never,
      loaded as never,
      {
        idempotencyKey: 'idem-1',
        intent: 'provision',
        mutation: 'executeKeycloakProvisioning',
        actorId: 'actor-1',
        requestId: 'req-1',
        tenantAdminTemporaryPassword: queuedTemporaryPassword,
      } as never
    );

    expect(result.run.id).toBe('run-queued');
    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-1',
        payloadFingerprint: expect.any(String),
      })
    );
    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-queued',
        stepKey: 'queued',
        details: expect.objectContaining({
          tenantAdminTemporaryPasswordCiphertext: `enc:${queuedTemporaryPassword}`,
        }),
      })
    );
  });

  it('createQueuedRun returns replayed runs without appending another queued step', async () => {
    const repository = {
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        created: false,
        run: { id: 'run-replayed', steps: [{ stepKey: 'queued' }] },
      }),
      appendKeycloakProvisioningStep: vi.fn(),
    };

    const result = await createQueuedRun(
      {
        repository: repository as never,
      } as never,
      createLoaded() as never,
      {
        idempotencyKey: 'idem-replay',
        intent: 'provision',
        mutation: 'reconcileKeycloak',
        actorId: 'actor-1',
        requestId: 'req-1',
        rotateClientSecret: false,
      } as never
    );

    expect(result.run.id).toBe('run-replayed');
    expect(repository.appendKeycloakProvisioningStep).not.toHaveBeenCalled();
  });

  it('syncProvisionedClientSecretToRegistry skips update when secret already loaded', async () => {
    const repository = {
      updateInstance: vi.fn(),
    };

    await syncProvisionedClientSecretToRegistry(
      {
        repository: repository as never,
      } as never,
      {
        loaded: createLoaded() as never,
      }
    );

    expect(state.readKeycloakStateViaProvisioner).not.toHaveBeenCalled();
    expect(repository.updateInstance).not.toHaveBeenCalled();
  });

  it('syncRotatedClientSecretToRegistry throws when keycloak returns empty secret', async () => {
    state.readKeycloakStateViaProvisioner.mockResolvedValueOnce({ keycloakClientSecret: undefined });

    const repository = {
      updateInstance: vi.fn(),
    };

    await expect(
      syncRotatedClientSecretToRegistry(
        {
          repository: repository as never,
        } as never,
        {
          loaded: createLoaded({ authClientSecretConfigured: false, authClientSecret: undefined }) as never,
        }
      )
    ).rejects.toThrow('tenant_auth_client_secret_missing_after_rotation');
  });

  it('completeRun throws when getKeycloakStatus dependency is missing', async () => {
    const repository = {
      appendKeycloakProvisioningStep: vi.fn(),
      updateKeycloakProvisioningRun: vi.fn(),
      setInstanceStatus: vi.fn(),
    };

    await expect(
      completeRun(
        {
          repository: repository as never,
          getKeycloakStatus: undefined,
        } as never,
        {
          loaded: createLoaded() as never,
          runId: 'run-1',
          intent: 'provision',
        }
      )
    ).rejects.toThrow('dependency_missing_getKeycloakStatus');
  });

  it('completeRun marks failed when status requirements are not satisfied', async () => {
    state.requirementsSatisfied.mockReturnValue(false);

    const repository = {
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      setInstanceStatus: vi.fn().mockResolvedValue(undefined),
    };

    const finalStatus = await completeRun(
      {
        repository: repository as never,
        getKeycloakStatus: vi.fn().mockResolvedValue({
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
        }),
      } as never,
      {
        loaded: createLoaded({ status: 'active' }) as never,
        runId: 'run-2',
        intent: 'provision',
      }
    );

    expect(finalStatus).toBe('failed');
    expect(repository.setInstanceStatus).not.toHaveBeenCalled();
    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ overallStatus: 'failed' })
    );
  });
});
