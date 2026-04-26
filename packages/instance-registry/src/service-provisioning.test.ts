import { describe, expect, it, vi } from 'vitest';

import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { createProvisioningArtifacts, provisionInstanceAuth } from './service-provisioning.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

type ProvisioningRepositoryMock = Pick<
  InstanceRegistryRepository,
  'appendAuditEvent' | 'createProvisioningRun' | 'setInstanceStatus'
>;

const asRepository = (repository: Partial<ProvisioningRepositoryMock>): InstanceRegistryRepository =>
  repository as InstanceRegistryRepository;

const createRun = (status: InstanceProvisioningRun['status']): InstanceProvisioningRun => ({
  id: `run-${status}`,
  instanceId: 'de-test',
  operation: 'create',
  status,
  idempotencyKey: 'idem-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('service-provisioning', () => {
  const baseInstance: InstanceRegistryRecord = {
    instanceId: 'de-test',
    displayName: 'Test Instance',
    primaryHostname: 'de-test.studio.smart-village.app',
    parentDomain: 'studio.smart-village.app',
    realmMode: 'new',
    authRealm: 'de-test',
    authClientId: 'sva-studio',
    authIssuerUrl: 'https://de-test.studio.smart-village.app/auth',
    authClientSecretConfigured: true,
    status: 'requested',
    featureFlags: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const baseInput: CreateInstanceProvisioningInput = {
    idempotencyKey: 'idem-1',
    instanceId: 'de-test',
    displayName: 'Test Instance',
    parentDomain: 'studio.smart-village.app',
    realmMode: 'new',
    authRealm: 'de-test',
    authClientId: 'sva-studio',
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
      createProvisioningRun: vi.fn(async () => createRun('requested')),
      appendAuditEvent: vi.fn(async () => undefined),
    } satisfies Partial<ProvisioningRepositoryMock>;

    await createProvisioningArtifacts(asRepository(repository), baseInstance, baseInput);

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
    const repository = {
      createProvisioningRun: vi.fn(async () => createRun('requested')),
      setInstanceStatus: vi.fn(async () => baseInstance),
    } satisfies Partial<ProvisioningRepositoryMock>;
    const deps = {
      repository: asRepository(repository),
      invalidateHost: vi.fn(),
      provisionInstanceAuth: undefined,
    } satisfies InstanceRegistryServiceDeps;

    const result = await provisionInstanceAuth(deps, baseInstance, baseInput);

    expect(result).toEqual(baseInstance);
    expect(repository.createProvisioningRun).not.toHaveBeenCalled();
  });

  it('stores provisioning progress and validates instance on success', async () => {
    const validatedInstance: InstanceRegistryRecord = { ...baseInstance, status: 'validated' };
    const repository = {
      createProvisioningRun: vi.fn(async () => createRun('provisioning')),
      setInstanceStatus: vi.fn(async () => validatedInstance),
    } satisfies Partial<ProvisioningRepositoryMock>;
    const authProvisioner = vi.fn(async () => undefined);
    const deps = {
      repository: asRepository(repository),
      invalidateHost: vi.fn(),
      provisionInstanceAuth: authProvisioner,
    } satisfies InstanceRegistryServiceDeps;

    const result = await provisionInstanceAuth(deps, baseInstance, baseInput);

    expect(result).toEqual(validatedInstance);
    expect(authProvisioner).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-test',
        authClientSecret: 'tenant-secret',
        tenantAdminBootstrap: baseInput.tenantAdminBootstrap,
      })
    );
    expect(deps.repository.setInstanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'de-test', status: 'validated' })
    );
    expect(repository.createProvisioningRun).toHaveBeenCalledTimes(2);
  });

  it('stores failed status and error metadata when provisioning throws', async () => {
    const failedInstance: InstanceRegistryRecord = { ...baseInstance, status: 'failed' };
    const repository = {
      createProvisioningRun: vi.fn(async () => createRun('failed')),
      setInstanceStatus: vi.fn(async () => failedInstance),
    } satisfies Partial<ProvisioningRepositoryMock>;
    const deps = {
      repository: asRepository(repository),
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(async () => {
        throw new Error('keycloak down');
      }),
    } satisfies InstanceRegistryServiceDeps;

    const result = await provisionInstanceAuth(deps, baseInstance, baseInput);

    expect(result).toEqual(failedInstance);
    expect(repository.setInstanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'de-test', status: 'failed' })
    );
    expect(repository.createProvisioningRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'keycloak_provisioning_failed',
        errorMessage: 'keycloak down',
      })
    );
  });
});
