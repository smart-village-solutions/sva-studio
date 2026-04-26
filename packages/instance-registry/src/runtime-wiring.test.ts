import { describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository, SqlExecutor } from '@sva/data-repositories';

import { createInstanceRegistryRuntime, type InstanceRegistryQueryClient } from './runtime-wiring.js';

const createClient = (): InstanceRegistryQueryClient => ({
  query: vi.fn(async () => ({ rowCount: 1, rows: [{ id: 'row-1' }] })),
  release: vi.fn(),
});

describe('runtime wiring', () => {
  it('creates repositories from connected SQL executors and always releases clients', async () => {
    const client = createClient();
    const repository = { marker: 'repository' } as unknown as InstanceRegistryRepository;
    let capturedExecutor: SqlExecutor | undefined;
    const runtime = createInstanceRegistryRuntime({
      resolvePool: () => ({ connect: async () => client }),
      createRepository: (executor) => {
        capturedExecutor = executor;
        return repository;
      },
      serviceDeps: {
        invalidateHost: vi.fn(),
      },
    });

    const result = await runtime.withRegistryRepository(async (resolvedRepository) => {
      await capturedExecutor?.execute({ text: 'select 1', values: ['demo'] });
      return resolvedRepository;
    });

    expect(result).toBe(repository);
    expect(client.query).toHaveBeenCalledWith('select 1', ['demo']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('fails early when the IAM database pool is not configured', async () => {
    const runtime = createInstanceRegistryRuntime({
      resolvePool: () => null,
      createRepository: vi.fn(),
      serviceDeps: {
        invalidateHost: vi.fn(),
      },
    });

    await expect(runtime.withRegistryRepository(async () => null)).rejects.toThrow('IAM database not configured');
  });

  it('uses dedicated provisioning worker service dependencies when supplied', async () => {
    const repository = { marker: 'repository' } as unknown as InstanceRegistryRepository;
    const runtime = createInstanceRegistryRuntime({
      resolvePool: () => ({ connect: async () => createClient() }),
      createRepository: () => repository,
      serviceDeps: {
        invalidateHost: vi.fn(),
      },
      provisioningWorkerServiceDeps: {
        invalidateHost: vi.fn(),
        protectSecret: vi.fn((value) => value ?? null),
      },
    });

    const deps = await runtime.withRegistryProvisioningWorkerDeps(async (resolvedDeps) => resolvedDeps);

    expect(deps.repository).toBe(repository);
    expect(deps.protectSecret?.('secret', 'aad')).toBe('secret');
  });
});
