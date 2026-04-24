import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePoolMock = vi.fn();
const createPoolResolverMock = vi.fn(() => resolvePoolMock);
const createInstanceRegistryRepositoryMock = vi.fn();
const createInstanceRegistryServiceMock = vi.fn();
const invalidateInstanceRegistryHostMock = vi.fn();

vi.mock('../shared/db-helpers.js', () => ({
  createPoolResolver: createPoolResolverMock,
}));

vi.mock('@sva/data-repositories', () => ({
  createInstanceRegistryRepository: createInstanceRegistryRepositoryMock,
}));

vi.mock('@sva/data/server', () => ({
  invalidateInstanceRegistryHost: invalidateInstanceRegistryHostMock,
}));

vi.mock('./service.js', () => ({
  createInstanceRegistryService: createInstanceRegistryServiceMock,
}));

describe('iam-instance-registry repository wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('throws when no IAM database pool is configured', async () => {
    resolvePoolMock.mockReturnValue(null);
    const { withRegistryRepository } = await import('./repository.js');

    await expect(withRegistryRepository(async () => 'ok')).rejects.toThrow('IAM database not configured');
  });

  it('creates an executor-backed repository and always releases the client', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'row-1' }] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });
    resolvePoolMock.mockReturnValue({ connect });
    createInstanceRegistryRepositoryMock.mockImplementation(({ execute }) => ({
      probe: () => execute({ text: 'select 1', values: ['demo'] }),
    }));

    const { withRegistryRepository } = await import('./repository.js');
    const result = await withRegistryRepository(async (repository: { probe: () => Promise<unknown> }) =>
      repository.probe()
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('select 1', ['demo']);
    expect(result).toEqual({ rowCount: 1, rows: [{ id: 'row-1' }] });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('wires the app service without direct keycloak admin dependencies', async () => {
    const release = vi.fn();
    resolvePoolMock.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }), release }),
    });
    const repository = { marker: 'repo' };
    createInstanceRegistryRepositoryMock.mockReturnValue(repository);
    const service = { marker: 'service' };
    createInstanceRegistryServiceMock.mockReturnValue(service);

    const { withRegistryService } = await import('./repository.js');
    const result = await withRegistryService(async (resolvedService) => resolvedService);

    expect(result).toBe(service);
    expect(createInstanceRegistryServiceMock).toHaveBeenCalledWith({
      repository,
      invalidateHost: invalidateInstanceRegistryHostMock,
    });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('wires the provisioning worker service with dedicated keycloak dependencies', async () => {
    const release = vi.fn();
    resolvePoolMock.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }), release }),
    });
    const repository = { marker: 'repo' };
    createInstanceRegistryRepositoryMock.mockReturnValue(repository);
    const service = { marker: 'service' };
    createInstanceRegistryServiceMock.mockReturnValue(service);

    const { withRegistryProvisioningWorkerService } = await import('./repository.js');
    const result = await withRegistryProvisioningWorkerService(async (resolvedService) => resolvedService);

    expect(result).toBe(service);
    expect(createInstanceRegistryServiceMock).toHaveBeenCalledWith({
      repository,
      invalidateHost: invalidateInstanceRegistryHostMock,
      provisionInstanceAuth: expect.any(Function),
      getKeycloakPreflight: expect.any(Function),
      planKeycloakProvisioning: expect.any(Function),
      getKeycloakStatus: expect.any(Function),
    });
    expect(release).toHaveBeenCalledTimes(1);
  });
});
