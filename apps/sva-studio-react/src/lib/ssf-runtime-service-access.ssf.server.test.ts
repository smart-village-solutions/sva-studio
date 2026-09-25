import { beforeEach, describe, expect, it, vi } from 'vitest';

const authRuntimeMocks = vi.hoisted(() => ({
  createSsfRuntimePluginServiceAccess: vi.fn(
    (dependencies: {
      readonly readDatabaseReadiness: (instanceId: string) => Promise<boolean>;
      readonly readAuthorizationRevision: (instanceId: string) => Promise<string | null>;
    }) => dependencies
  ),
}));

const ssfRuntimeMocks = vi.hoisted(() => ({
  pool: {} as object,
  readReadySsfAuthorizationRevision: vi.fn(),
  readSsfTenant: vi.fn(),
  resolveSsfDatabasePool: vi.fn(),
}));

const loginReadinessMocks = vi.hoisted(() => ({ readStudioSsfLoginReadiness: vi.fn() }));

vi.mock('@sva/auth-runtime/server', () => authRuntimeMocks);
vi.mock('@sva/plugin-ssf/runtime', () => ssfRuntimeMocks);
vi.mock('./ssf-login-readiness.server.js', () => loginReadinessMocks);

import { createStudioSsfRuntimeServiceAccess } from './ssf-runtime-service-access.ssf.server.js';

const readRegisteredDependencies = () => {
  const dependencies = authRuntimeMocks.createSsfRuntimePluginServiceAccess.mock.calls.at(-1)?.[0];
  if (!dependencies) throw new Error('SSF runtime service access was not registered');
  return dependencies;
};

describe('SSF runtime service access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ssfRuntimeMocks.resolveSsfDatabasePool.mockReturnValue(null);
  });

  it('binds SSF readiness providers to one configured plugin database pool', async () => {
    ssfRuntimeMocks.resolveSsfDatabasePool.mockReturnValue(ssfRuntimeMocks.pool);
    ssfRuntimeMocks.readSsfTenant.mockResolvedValue({ instanceId: 'tenant-a' });
    ssfRuntimeMocks.readReadySsfAuthorizationRevision.mockResolvedValue('sha256:revision');

    createStudioSsfRuntimeServiceAccess();
    const dependencies = readRegisteredDependencies();

    await expect(dependencies.readDatabaseReadiness('tenant-a')).resolves.toBe(true);
    await expect(dependencies.readAuthorizationRevision('tenant-a')).resolves.toBe(
      'sha256:revision'
    );
    expect(ssfRuntimeMocks.readSsfTenant).toHaveBeenCalledWith(ssfRuntimeMocks.pool, 'tenant-a');
    expect(ssfRuntimeMocks.readReadySsfAuthorizationRevision).toHaveBeenCalledWith(
      ssfRuntimeMocks.pool,
      'tenant-a'
    );
  });

  it('keeps SSF readiness closed without a configured plugin database', async () => {
    createStudioSsfRuntimeServiceAccess();
    const dependencies = readRegisteredDependencies();

    await expect(dependencies.readDatabaseReadiness('tenant-a')).resolves.toBe(false);
    await expect(dependencies.readAuthorizationRevision('tenant-a')).resolves.toBeNull();
    expect(ssfRuntimeMocks.readSsfTenant).not.toHaveBeenCalled();
    expect(ssfRuntimeMocks.readReadySsfAuthorizationRevision).not.toHaveBeenCalled();
  });
});
