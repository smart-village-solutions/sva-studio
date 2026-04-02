import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHostnameMock = vi.hoisted(() => vi.fn());
const getInstanceByIdMock = vi.hoisted(() => vi.fn());
const createInstanceRegistryRepositoryMock = vi.hoisted(() =>
  vi.fn(() => ({
    resolveHostname: resolveHostnameMock,
    getInstanceById: getInstanceByIdMock,
  }))
);
const connectMock = vi.hoisted(() => vi.fn());
const poolInstances: Array<{ end?: () => Promise<void> }> = [];

const PoolMock = vi.hoisted(() =>
  vi.fn().mockImplementation(function MockPool() {
    const pool = {
      connect: connectMock,
      end: vi.fn(async () => undefined),
    };
    poolInstances.push(pool);
    return pool;
  })
);

vi.mock('pg', () => ({
  Pool: PoolMock,
}));

vi.mock('./index', () => ({
  createInstanceRegistryRepository: createInstanceRegistryRepositoryMock,
}));

describe('instance-registry server helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    poolInstances.splice(0, poolInstances.length);
    connectMock.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: vi.fn(),
    });
    resolveHostnameMock.mockResolvedValue(null);
    getInstanceByIdMock.mockResolvedValue(null);
  });

  it('throws when the IAM database is not configured', async () => {
    const { loadInstanceByHostname } = await import('./server');

    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');
  });

  it('loads, caches, invalidates, and refreshes hostname lookups', async () => {
    const { invalidateInstanceRegistryHost, loadInstanceByHostname, resetInstanceRegistryCache } = await import('./server');
    resolveHostnameMock.mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(7_000)
      .mockReturnValueOnce(7_000);
    const options = {
      cacheTtlMs: 5_000,
      now,
      getDatabaseUrl: () => 'postgres://iam',
    };

    await expect(loadInstanceByHostname('Demo.Studio.Example.org', options)).resolves.toMatchObject({
      instanceId: 'demo',
    });
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(1);

    invalidateInstanceRegistryHost('demo.studio.example.org');
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(2);

    resetInstanceRegistryCache();
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(3);
    expect(PoolMock).toHaveBeenCalledTimes(1);
  });

  it('loads instances by id without using the hostname cache', async () => {
    const { loadInstanceById } = await import('./server');
    getInstanceByIdMock.mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      loadInstanceById('demo', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).resolves.toMatchObject({ instanceId: 'demo' });

    expect(getInstanceByIdMock).toHaveBeenCalledWith('demo');
    expect(resolveHostnameMock).not.toHaveBeenCalled();
  });
});
