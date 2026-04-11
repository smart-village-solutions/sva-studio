import { describe, expect, it, vi } from 'vitest';

import { createProvisioningArtifacts, provisionInstanceAuth } from './service-provisioning.js';

describe('service-provisioning', () => {
  const baseInstance = {
    instanceId: 'de-test',
    primaryHostname: 'de-test.studio.smart-village.app',
    parentDomain: 'studio.smart-village.app',
    realmMode: 'new' as const,
    authRealm: 'de-test',
    authClientId: 'sva-studio',
    authIssuerUrl: 'https://de-test.studio.smart-village.app/auth',
    status: 'requested' as const,
  };

  const baseInput = {
    idempotencyKey: 'idem-1',
    actorId: 'user-1',
    requestId: 'req-1',
    authClientSecret: 'tenant-secret',
    tenantAdminBootstrap: {
      username: 'tenant-admin',
      email: 'tenant-admin@example.invalid',
      firstName: 'Tenant',
      lastName: 'Admin',
    },
  };

  it('creates provisioning run and audit event artifacts', async () => {
    const repository = {
      createProvisioningRun: vi.fn(async () => undefined),
      appendAuditEvent: vi.fn(async () => undefined),
    } as any;

    await createProvisioningArtifacts(repository, baseInstance as any, baseInput as any);

    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-test',
        operation: 'create',
        status: 'requested',
        idempotencyKey: 'idem-1',
      })
    );
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-test',
        eventType: 'instance_requested',
      })
    );
  });

  it('returns the input instance when no auth provisioner exists', async () => {
    const deps = {
      repository: {
        createProvisioningRun: vi.fn(async () => undefined),
        setInstanceStatus: vi.fn(async () => baseInstance),
      },
      provisionInstanceAuth: undefined,
    } as any;

    const result = await provisionInstanceAuth(deps, baseInstance as any, baseInput as any);

    expect(result).toEqual(baseInstance);
    expect(deps.repository.createProvisioningRun).not.toHaveBeenCalled();
  });

  it('stores provisioning progress and validates instance on success', async () => {
    const validatedInstance = { ...baseInstance, status: 'validated' };
    const deps = {
      repository: {
        createProvisioningRun: vi.fn(async () => undefined),
        setInstanceStatus: vi.fn(async () => validatedInstance),
      },
      provisionInstanceAuth: vi.fn(async () => undefined),
    } as any;

    const result = await provisionInstanceAuth(deps, baseInstance as any, baseInput as any);

    expect(result).toEqual(validatedInstance);
    expect(deps.provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-test',
        authClientSecret: 'tenant-secret',
        tenantAdminBootstrap: baseInput.tenantAdminBootstrap,
      })
    );
    expect(deps.repository.setInstanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'de-test', status: 'validated' })
    );
    expect(deps.repository.createProvisioningRun).toHaveBeenCalledTimes(2);
  });

  it('stores failed status and error metadata when provisioning throws', async () => {
    const failedInstance = { ...baseInstance, status: 'failed' };
    const deps = {
      repository: {
        createProvisioningRun: vi.fn(async () => undefined),
        setInstanceStatus: vi.fn(async () => failedInstance),
      },
      provisionInstanceAuth: vi.fn(async () => {
        throw new Error('keycloak down');
      }),
    } as any;

    const result = await provisionInstanceAuth(deps, baseInstance as any, baseInput as any);

    expect(result).toEqual(failedInstance);
    expect(deps.repository.setInstanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'de-test', status: 'failed' })
    );
    expect(deps.repository.createProvisioningRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'keycloak_provisioning_failed',
        errorMessage: 'keycloak down',
      })
    );
  });
});