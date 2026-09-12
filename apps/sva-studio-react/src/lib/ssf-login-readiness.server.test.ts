import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  access: vi.fn(),
  pool: {},
  resolvePool: vi.fn(),
  revision: vi.fn(),
  ready: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({ readConfiguredPluginTenantAccess: mocks.access }));
vi.mock('@sva/plugin-ssf/runtime', () => ({
  readReadySsfAuthorizationRevision: mocks.revision,
  resolveSsfDatabasePool: mocks.resolvePool,
}));
vi.mock('./plugin-activation-policy-bootstrap.server.js', () => ({
  ensurePluginActivationPoliciesConfigured: mocks.configure,
}));
vi.mock('./ssf-authorization-projection-runtime.server.js', () => ({
  createStudioSsfAuthorizationProjectionTarget: () => ({ isReady: mocks.ready }),
}));
import { readStudioSsfLoginReadiness } from './ssf-login-readiness.server.js';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolvePool.mockReturnValue(mocks.pool);
  mocks.access.mockResolvedValue({ allowed: true, reason: 'ready' });
  mocks.revision.mockResolvedValue('sha256:confirmed');
  mocks.ready.mockResolvedValue(true);
});
it('requires the same confirmed revision before and after the live client read-back', async () => {
  expect(await readStudioSsfLoginReadiness('tenant-a', 'sha256:confirmed')).toBe(true);
  expect(mocks.ready).toHaveBeenCalledWith('tenant-a', 'sha256:confirmed');
  mocks.revision.mockResolvedValueOnce('sha256:confirmed').mockResolvedValueOnce(null);
  expect(await readStudioSsfLoginReadiness('tenant-a')).toBe(false);
});
it.each(['pending', 'blocked', 'degraded', 'not_managed'])(
  'does not turn lifecycle %s into login readiness',
  async (reason) => {
    mocks.access.mockResolvedValue({
      allowed: reason === 'degraded' || reason === 'not_managed',
      reason,
    });
    expect(await readStudioSsfLoginReadiness('tenant-a')).toBe(false);
    expect(mocks.ready).not.toHaveBeenCalled();
  }
);
it('requires both a runtime database and matching authorization and preserves upstream failures', async () => {
  expect(await readStudioSsfLoginReadiness('tenant-a', 'sha256:stale')).toBe(false);
  mocks.resolvePool.mockReturnValue(null);
  expect(await readStudioSsfLoginReadiness('tenant-a')).toBe(false);
  mocks.resolvePool.mockReturnValue(mocks.pool);
  mocks.ready.mockRejectedValue(new Error('keycloak unavailable'));
  await expect(readStudioSsfLoginReadiness('tenant-a')).rejects.toThrow('keycloak unavailable');
});
it('isolates two tenants and rejects a false-ready client independently', async () => {
  mocks.ready.mockImplementation(async (id) => id === 'tenant-a');
  expect(await readStudioSsfLoginReadiness('tenant-a')).toBe(true);
  expect(await readStudioSsfLoginReadiness('tenant-b')).toBe(false);
});
