import { describe, expect, it, vi } from 'vitest';

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn((value: string) => `enc:${value}`),
  revealField: vi.fn((value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('enc:') ? value.slice(4) : undefined
  ),
}));

import { createInstanceRegistryService } from './service.js';

import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceAuditEvent, InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/data';

const now = '2026-01-01T00:00:00.000Z';

const createRepository = (): InstanceRegistryRepository => {
  const instances = new Map<string, InstanceRegistryRecord>();
  const provisioningRuns = new Map<string, InstanceProvisioningRun[]>();
  const auditEvents = new Map<string, InstanceAuditEvent[]>();
  const secretCiphertexts = new Map<string, string | null>();

  return {
    async listInstances(input = {}) {
      return [...instances.values()].filter((instance) => {
        const matchesSearch = input.search
          ? instance.instanceId.includes(input.search) || instance.displayName.includes(input.search)
          : true;
        const matchesStatus = input.status ? instance.status === input.status : true;
        return matchesSearch && matchesStatus;
      });
    },
    async getInstanceById(instanceId) {
      return instances.get(instanceId) ?? null;
    },
    async getAuthClientSecretCiphertext(instanceId) {
      return secretCiphertexts.get(instanceId) ?? null;
    },
    async resolveHostname(hostname) {
      return [...instances.values()].find((instance) => instance.primaryHostname === hostname) ?? null;
    },
    async listProvisioningRuns(instanceId) {
      return provisioningRuns.get(instanceId) ?? [];
    },
    async listLatestProvisioningRuns(instanceIds) {
      return Object.fromEntries(
        instanceIds.map((instanceId) => [instanceId, (provisioningRuns.get(instanceId) ?? [])[0]])
      );
    },
    async listAuditEvents(instanceId) {
      return auditEvents.get(instanceId) ?? [];
    },
    async createInstance(input) {
      const record: InstanceRegistryRecord = {
        instanceId: input.instanceId,
        displayName: input.displayName,
        status: input.status,
        parentDomain: input.parentDomain,
        primaryHostname: input.primaryHostname,
        authRealm: input.authRealm,
        authClientId: input.authClientId,
        authIssuerUrl: input.authIssuerUrl,
        authClientSecretConfigured: Boolean(input.authClientSecretCiphertext),
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        themeKey: input.themeKey,
        featureFlags: input.featureFlags ?? {},
        mainserverConfigRef: input.mainserverConfigRef,
        createdAt: now,
        createdBy: input.actorId,
        updatedAt: now,
        updatedBy: input.actorId,
      };
      secretCiphertexts.set(record.instanceId, input.authClientSecretCiphertext ?? null);
      instances.set(record.instanceId, record);
      return record;
    },
    async updateInstance(input) {
      const current = instances.get(input.instanceId);
      if (!current) {
        return null;
      }

      const updated: InstanceRegistryRecord = {
        ...current,
        displayName: input.displayName,
        parentDomain: input.parentDomain,
        primaryHostname: input.primaryHostname,
        authRealm: input.authRealm,
        authClientId: input.authClientId,
        authIssuerUrl: input.authIssuerUrl,
        authClientSecretConfigured: input.keepExistingAuthClientSecret
          ? current.authClientSecretConfigured
          : Boolean(input.authClientSecretCiphertext),
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        themeKey: input.themeKey,
        featureFlags: input.featureFlags ?? {},
        mainserverConfigRef: input.mainserverConfigRef,
        updatedAt: now,
        updatedBy: input.actorId,
      };
      if (!input.keepExistingAuthClientSecret) {
        secretCiphertexts.set(updated.instanceId, input.authClientSecretCiphertext ?? null);
      }
      instances.set(updated.instanceId, updated);
      return updated;
    },
    async setInstanceStatus(input) {
      const current = instances.get(input.instanceId);
      if (!current) {
        return null;
      }

      const updated: InstanceRegistryRecord = {
        ...current,
        status: input.status,
        updatedAt: now,
        updatedBy: input.actorId,
      };
      instances.set(updated.instanceId, updated);
      return updated;
    },
    async createProvisioningRun(input) {
      const run: InstanceProvisioningRun = {
        id: `${input.instanceId}-${input.operation}-${input.status}`,
        instanceId: input.instanceId,
        operation: input.operation,
        status: input.status,
        stepKey: input.stepKey,
        idempotencyKey: input.idempotencyKey,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        requestId: input.requestId,
        actorId: input.actorId,
        createdAt: now,
        updatedAt: now,
      };
      provisioningRuns.set(input.instanceId, [run, ...(provisioningRuns.get(input.instanceId) ?? [])]);
      return run;
    },
    async appendAuditEvent(input) {
      const event: InstanceAuditEvent = {
        id: `${input.instanceId}-${input.eventType}`,
        instanceId: input.instanceId,
        eventType: input.eventType,
        actorId: input.actorId,
        requestId: input.requestId,
        details: input.details ?? {},
        createdAt: now,
      };
      auditEvents.set(input.instanceId, [event, ...(auditEvents.get(input.instanceId) ?? [])]);
    },
  };
};

describe('iam-instance-registry service', () => {
  it('resolves a newly provisioned instance without requiring a redeploy', async () => {
    const invalidateHost = vi.fn();
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const service = createInstanceRegistryService({
      repository: createRepository(),
      invalidateHost,
      provisionInstanceAuth,
    });

    const created = await service.createProvisioningRequest({
      idempotencyKey: 'idem-create',
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.lvh.me',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error('Instanzanlage fehlgeschlagen.');
    }

    const resolved = await service.resolveRuntimeInstance('demo.studio.lvh.me');

    expect(resolved.hostClassification.kind).toBe('tenant');
    expect(resolved.instance).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        status: 'validated',
        primaryHostname: 'demo.studio.lvh.me',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      })
    );
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.lvh.me');
    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      })
    );
  });

  it('passes tenant auth bootstrap values through the create provisioning path', async () => {
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const service = createInstanceRegistryService({
      repository: createRepository(),
      invalidateHost: vi.fn(),
      provisionInstanceAuth,
    });

    const created = await service.createProvisioningRequest({
      idempotencyKey: 'idem-create',
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.lvh.me',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecret: 'tenant-client-secret',
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant-admin@test.invalid',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    expect(created.ok).toBe(true);
    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authClientSecret: 'tenant-client-secret',
        tenantAdminBootstrap: {
          username: 'tenant-admin',
          email: 'tenant-admin@test.invalid',
          firstName: 'Tenant',
          lastName: 'Admin',
        },
      })
    );
  });

  it('records follow-up runs and audit events when an instance is activated', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'provisioning',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'hb.studio.lvh.me',
      authRealm: 'hb',
      authClientId: 'sva-studio',
      actorId: 'actor-1',
      requestId: 'req-1',
    });
    await repository.createProvisioningRun({
      instanceId: 'hb',
      operation: 'create',
      status: 'provisioning',
      idempotencyKey: 'idem-create',
      actorId: 'actor-1',
      requestId: 'req-1',
    });
    await repository.appendAuditEvent({
      instanceId: 'hb',
      eventType: 'instance_requested',
      actorId: 'actor-1',
      requestId: 'req-1',
      details: {},
    });

    const changed = await service.changeStatus({
      idempotencyKey: 'idem-activate',
      instanceId: 'hb',
      nextStatus: 'active',
      actorId: 'actor-2',
      requestId: 'req-2',
    });

    expect(changed).toEqual(
      expect.objectContaining({
        ok: true,
        instance: expect.objectContaining({
          instanceId: 'hb',
          status: 'active',
        }),
      })
    );

    const detail = await service.getInstanceDetail('hb');
    expect(detail?.provisioningRuns.map((run) => run.operation)).toEqual(['activate', 'create']);
    expect(detail?.auditEvents.map((event) => event.eventType)).toEqual(['instance_activated', 'instance_requested']);
  });

  it('loads latest provisioning runs for list views in a single repository call', async () => {
    const repository = createRepository();
    const listLatestProvisioningRuns = vi.spyOn(repository, 'listLatestProvisioningRuns');
    const listProvisioningRuns = vi.spyOn(repository, 'listProvisioningRuns');
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'active',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'hb.studio.lvh.me',
      authRealm: 'hb',
      authClientId: 'sva-studio',
    });
    await repository.createProvisioningRun({
      instanceId: 'hb',
      operation: 'activate',
      status: 'active',
      idempotencyKey: 'idem-hb',
    });
    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'demo.studio.lvh.me',
      authRealm: 'demo',
      authClientId: 'sva-studio',
    });
    await repository.createProvisioningRun({
      instanceId: 'demo',
      operation: 'create',
      status: 'requested',
      idempotencyKey: 'idem-demo',
    });

    const items = await service.listInstances();

    expect(items).toHaveLength(2);
    expect(listLatestProvisioningRuns).toHaveBeenCalledWith(['hb', 'demo']);
    expect(listProvisioningRuns).not.toHaveBeenCalled();
    expect(items.map((item) => item.latestProvisioningRun?.id)).toEqual(['hb-activate-active', 'demo-create-requested']);
  });

  it('marks the instance as failed when auth provisioning throws', async () => {
    const service = createInstanceRegistryService({
      repository: createRepository(),
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const created = await service.createProvisioningRequest({
      idempotencyKey: 'idem-fail',
      instanceId: 'failed-demo',
      displayName: 'Failed Demo',
      parentDomain: 'studio.lvh.me',
      authRealm: 'failed-demo',
      authClientId: 'sva-studio',
    });

    expect(created).toEqual(
      expect.objectContaining({
        ok: true,
        instance: expect.objectContaining({
          instanceId: 'failed-demo',
          status: 'failed',
        }),
      })
    );
  });

  it('updates instance details, normalizes the parent domain, and refreshes keycloak status', async () => {
    const repository = createRepository();
    const invalidateHost = vi.fn();
    const getKeycloakStatus = vi.fn().mockResolvedValue({
      realmExists: true,
      clientExists: true,
      instanceIdMapperExists: true,
      tenantAdminExists: true,
    });
    const service = createInstanceRegistryService({
      repository,
      invalidateHost,
      getKeycloakStatus,
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'demo.studio.lvh.me',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretCiphertext: 'enc:old-secret',
      tenantAdminBootstrap: {
        username: 'demo-admin',
        email: 'demo@example.org',
      },
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    const updated = await service.updateInstance({
      instanceId: 'demo',
      displayName: 'Demo Updated',
      parentDomain: 'Studio.Example.org',
      authRealm: 'demo-updated',
      authClientId: 'tenant-client',
      authIssuerUrl: 'https://issuer.example.org',
      actorId: 'actor-2',
      requestId: 'req-2',
      tenantAdminBootstrap: {
        username: 'new-admin',
      },
    });

    expect(updated).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        displayName: 'Demo Updated',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        authRealm: 'demo-updated',
        authClientId: 'tenant-client',
        authClientSecretConfigured: true,
        keycloakStatus: expect.objectContaining({
          realmExists: true,
          clientExists: true,
        }),
      })
    );
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.lvh.me');
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
    expect(getKeycloakStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authRealm: 'demo-updated',
        authClientId: 'tenant-client',
        authClientSecretConfigured: true,
        authClientSecret: 'old-secret',
        tenantAdminBootstrap: { username: 'new-admin' },
      })
    );
  });

  it('reconciles keycloak using the decrypted tenant secret and returns refreshed status', async () => {
    const repository = createRepository();
    const getKeycloakStatus = vi.fn().mockResolvedValue({ realmExists: true, clientSecretAligned: true });
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      getKeycloakStatus,
      provisionInstanceAuth,
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'validated',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretCiphertext: 'enc:test-client-secret',
      tenantAdminBootstrap: {
        username: 'demo-admin',
      },
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    const status = await service.reconcileKeycloak({
      instanceId: 'demo',
      actorId: 'actor-2',
      requestId: 'req-2',
      rotateClientSecret: true,
      tenantAdminTemporaryPassword: 'test-temp-password',
    });

    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authClientSecret: 'test-client-secret',
        rotateClientSecret: true,
        tenantAdminTemporaryPassword: 'test-temp-password',
      })
    );
    expect(getKeycloakStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authClientSecret: 'test-client-secret',
      })
    );
    expect(status).toEqual(expect.objectContaining({ realmExists: true, clientSecretAligned: true }));
  });

  it('fails keycloak reconcile when the tenant secret is missing and classifies unknown runtime hosts', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(),
      getKeycloakStatus: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    await expect(
      service.reconcileKeycloak({
        instanceId: 'demo',
        actorId: 'actor-2',
        requestId: 'req-2',
      })
    ).rejects.toThrow('tenant_auth_client_secret_missing');

    await expect(service.getKeycloakStatus('missing')).resolves.toBeNull();
    await expect(service.resolveRuntimeInstance('missing.studio.example.org')).resolves.toEqual({
      hostClassification: {
        kind: 'invalid',
        normalizedHost: 'missing.studio.example.org',
        reason: 'unknown_host',
      },
      instance: null,
    });
  });
});
