import { describe, expect, it, vi } from 'vitest';

const loggerState = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => loggerState.logger,
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn((value: string) => `enc:${value}`),
  revealField: vi.fn((value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('enc:') ? value.slice(4) : undefined
  ),
}));

import { createInstanceRegistryService } from './service.js';

import type { IamInstanceKeycloakProvisioningRun } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceAuditEvent, InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/data';

const now = '2026-01-01T00:00:00.000Z';

const createRepository = (): InstanceRegistryRepository => {
  const instances = new Map<string, InstanceRegistryRecord>();
  const provisioningRuns = new Map<string, InstanceProvisioningRun[]>();
  const auditEvents = new Map<string, InstanceAuditEvent[]>();
  const secretCiphertexts = new Map<string, string | null>();
  const keycloakProvisioningRuns = new Map<string, IamInstanceKeycloakProvisioningRun[]>();

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
    async listKeycloakProvisioningRuns(instanceId) {
      return keycloakProvisioningRuns.get(instanceId) ?? [];
    },
    async getKeycloakProvisioningRun(instanceId, runId) {
      return (keycloakProvisioningRuns.get(instanceId) ?? []).find((run) => run.id === runId) ?? null;
    },
    async claimNextKeycloakProvisioningRun() {
      for (const [instanceId, runs] of keycloakProvisioningRuns.entries()) {
        const targetIndex = runs.findIndex((run) => run.overallStatus === 'planned');
        if (targetIndex < 0) {
          continue;
        }
        const current = runs[targetIndex];
        if (!current) {
          continue;
        }
        const updated: IamInstanceKeycloakProvisioningRun = {
          ...current,
          overallStatus: 'running',
          updatedAt: now,
        };
        const nextRuns = [...runs];
        nextRuns[targetIndex] = updated;
        keycloakProvisioningRuns.set(instanceId, nextRuns);
        return updated;
      }
      return null;
    },
    async createInstance(input) {
      const record: InstanceRegistryRecord = {
        instanceId: input.instanceId,
        displayName: input.displayName,
        status: input.status,
        parentDomain: input.parentDomain,
        primaryHostname: input.primaryHostname,
        realmMode: input.realmMode,
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
        realmMode: input.realmMode,
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
    async createKeycloakProvisioningRun(input) {
      const run: IamInstanceKeycloakProvisioningRun = {
        id: `${input.instanceId}-${input.intent}-${input.overallStatus}`,
        instanceId: input.instanceId,
        mode: input.mode,
        intent: input.intent,
        overallStatus: input.overallStatus,
        driftSummary: input.driftSummary,
        requestId: input.requestId,
        actorId: input.actorId,
        createdAt: now,
        updatedAt: now,
        steps: [],
      };
      keycloakProvisioningRuns.set(input.instanceId, [run, ...(keycloakProvisioningRuns.get(input.instanceId) ?? [])]);
      return run;
    },
    async updateKeycloakProvisioningRun(input) {
      for (const [instanceId, runs] of keycloakProvisioningRuns.entries()) {
        const targetIndex = runs.findIndex((run) => run.id === input.runId);
        if (targetIndex < 0) {
          continue;
        }
        const current = runs[targetIndex];
        if (!current) {
          return null;
        }
        const updated: IamInstanceKeycloakProvisioningRun = {
          ...current,
          overallStatus: input.overallStatus,
          driftSummary: input.driftSummary,
          updatedAt: now,
        };
        const nextRuns = [...runs];
        nextRuns[targetIndex] = updated;
        keycloakProvisioningRuns.set(instanceId, nextRuns);
        return updated;
      }
      return null;
    },
    async appendKeycloakProvisioningStep(input) {
      for (const [instanceId, runs] of keycloakProvisioningRuns.entries()) {
        const targetIndex = runs.findIndex((run) => run.id === input.runId);
        if (targetIndex < 0) {
          continue;
        }
        const current = runs[targetIndex];
        if (!current) {
          throw new Error('run_not_found');
        }
        const step = {
          stepKey: input.stepKey,
          title: input.title,
          status: input.status,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          summary: input.summary,
          details: input.details ?? {},
          requestId: input.requestId,
        } as const;
        const updated: IamInstanceKeycloakProvisioningRun = {
          ...current,
          updatedAt: now,
          steps: [...current.steps, step],
        };
        const nextRuns = [...runs];
        nextRuns[targetIndex] = updated;
        keycloakProvisioningRuns.set(instanceId, nextRuns);
        return step;
      }
      throw new Error('run_not_found');
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
  it('logs duplicate create requests and successful host invalidation', async () => {
    loggerState.logger.debug.mockReset();
    loggerState.logger.info.mockReset();
    loggerState.logger.warn.mockReset();
    loggerState.logger.error.mockReset();

    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
    });

    await service.createProvisioningRequest({
      idempotencyKey: 'idem-create',
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.lvh.me',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      requestId: 'req-1',
    });
    await service.createProvisioningRequest({
      idempotencyKey: 'idem-create-2',
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.lvh.me',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      requestId: 'req-2',
    });

    expect(loggerState.logger.info).toHaveBeenCalledWith(
      'instance_create_completed',
      expect.objectContaining({ instance_id: 'demo', request_id: 'req-1' })
    );
    expect(loggerState.logger.warn).toHaveBeenCalledWith(
      'instance_create_rejected_duplicate',
      expect.objectContaining({ instance_id: 'demo', request_id: 'req-2' })
    );
    expect(loggerState.logger.debug).toHaveBeenCalledWith(
      'instance_host_cache_invalidated',
      expect.objectContaining({ instance_id: 'demo', hostname: 'demo.studio.lvh.me' })
    );
  });

  it('resolves a newly registered instance without requiring a redeploy', async () => {
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
      realmMode: 'new',
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
        status: 'requested',
        realmMode: 'new',
        primaryHostname: 'demo.studio.lvh.me',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      })
    );
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.lvh.me');
    expect(provisionInstanceAuth).not.toHaveBeenCalled();
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
      realmMode: 'new',
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
    expect(provisionInstanceAuth).not.toHaveBeenCalled();
    expect(created).toEqual(
      expect.objectContaining({
        ok: true,
        instance: expect.objectContaining({
          instanceId: 'demo',
          realmMode: 'new',
          authClientSecretConfigured: true,
          tenantAdminBootstrap: {
            username: 'tenant-admin',
            email: 'tenant-admin@test.invalid',
            firstName: 'Tenant',
            lastName: 'Admin',
          },
        }),
      })
    );
  });

  it('records follow-up runs and audit events when an instance is activated', async () => {
    loggerState.logger.debug.mockReset();
    loggerState.logger.info.mockReset();
    loggerState.logger.warn.mockReset();
    loggerState.logger.error.mockReset();
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
      realmMode: 'existing',
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
    expect(loggerState.logger.info).toHaveBeenCalledWith(
      'instance_status_transition_completed',
      expect.objectContaining({
        instance_id: 'hb',
        previous_status: 'provisioning',
        next_status: 'active',
      })
    );
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
      realmMode: 'existing',
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
      realmMode: 'new',
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

  it('keeps instance creation in requested state until provisioning is explicitly executed', async () => {
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
      realmMode: 'new',
      authRealm: 'failed-demo',
      authClientId: 'sva-studio',
    });

    expect(created).toEqual(
      expect.objectContaining({
        ok: true,
        instance: expect.objectContaining({
          instanceId: 'failed-demo',
          realmMode: 'new',
          status: 'requested',
        }),
      })
    );
  });

  it('updates instance details, normalizes the parent domain, and keeps keycloak status read-only', async () => {
    const repository = createRepository();
    const invalidateHost = vi.fn();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost,
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'demo.studio.lvh.me',
      realmMode: 'existing',
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
      realmMode: 'existing',
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
        realmMode: 'existing',
        authRealm: 'demo-updated',
        authClientId: 'tenant-client',
        authClientSecretConfigured: true,
        keycloakStatus: undefined,
      })
    );
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.lvh.me');
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
  });

  it('keeps instance detail readable when no worker snapshots are available', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'archived',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    const detail = await service.getInstanceDetail('demo');

    expect(detail).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        keycloakStatus: undefined,
        keycloakPreflight: expect.objectContaining({
          overallStatus: 'warning',
        }),
        keycloakPlan: expect.objectContaining({
          mode: 'existing',
        }),
      })
    );
  });

  it('reconcile enqueues a keycloak worker run instead of executing synchronously', async () => {
    const repository = createRepository();
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth,
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'validated',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
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

    expect(provisionInstanceAuth).not.toHaveBeenCalled();
    expect(status).toBeNull();

    const run = await repository.claimNextKeycloakProvisioningRun();
    expect(run).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        intent: 'rotate_client_secret',
        overallStatus: 'running',
      })
    );
  });

  it('returns not_found and invalid_transition for unsupported status operations', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
    });

    const missing = await service.changeStatus({
      idempotencyKey: 'idem-missing',
      instanceId: 'missing',
      nextStatus: 'active',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    const invalid = await service.changeStatus({
      idempotencyKey: 'idem-invalid',
      instanceId: 'demo',
      nextStatus: 'active',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    expect(missing).toEqual({ ok: false, reason: 'not_found' });
    expect(invalid).toEqual({ ok: false, reason: 'invalid_transition', currentStatus: 'requested' });
  });

  it('fails keycloak reconcile when the tenant secret is missing and classifies unknown runtime hosts', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(),
      getKeycloakPreflight: vi.fn().mockResolvedValue({
        overallStatus: 'ready',
        generatedAt: now,
        checks: [],
      }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({
        mode: 'existing',
        overallStatus: 'ready',
        generatedAt: now,
        driftSummary: 'Drift erkannt.',
        steps: [],
      }),
      getKeycloakStatus: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
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
