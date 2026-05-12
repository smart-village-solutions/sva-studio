import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  classifyHost: vi.fn(),
  isTrafficEnabledInstanceStatus: vi.fn(),
  loadInstanceByHostname: vi.fn(),
  createSdkLogger: vi.fn(),
  getInstanceConfig: vi.fn(),
  getWorkspaceContext: vi.fn(),
  resolveEffectiveRequestHost: vi.fn(),
  buildLogContext: vi.fn(),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();
  return {
    ...actual,
    classifyHost: state.classifyHost,
    isTrafficEnabledInstanceStatus: state.isTrafficEnabledInstanceStatus,
  };
});

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceByHostname: state.loadInstanceByHostname,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getInstanceConfig: state.getInstanceConfig,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('./request-hosts.js', () => ({
  resolveEffectiveRequestHost: state.resolveEffectiveRequestHost,
}));

vi.mock('./log-context.js', () => ({
  buildLogContext: state.buildLogContext,
}));

describe('middleware-hosts', () => {
  beforeEach(() => {
    vi.resetModules();
    state.classifyHost.mockReset();
    state.isTrafficEnabledInstanceStatus.mockReset();
    state.loadInstanceByHostname.mockReset();
    state.createSdkLogger.mockReset();
    state.getInstanceConfig.mockReset();
    state.getWorkspaceContext.mockReset();
    state.resolveEffectiveRequestHost.mockReset();
    state.buildLogContext.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();

    state.createSdkLogger.mockReturnValue(state.logger);
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });
    state.buildLogContext.mockReturnValue({ trace_id: 'trace-1' });
    state.resolveEffectiveRequestHost.mockReturnValue('tenant.example.test');
    state.getInstanceConfig.mockReturnValue({ parentDomain: 'example.test' });
    state.classifyHost.mockReturnValue({ kind: 'tenant' });
  });

  it('keeps session users unchanged when they already carry an instance id', async () => {
    const { resolveSessionUser } = await import('./middleware-hosts.js');
    const user = { id: 'user-1', instanceId: 'instance-1' } as const;

    await expect(resolveSessionUser(new Request('https://tenant.example.test'), user as never)).resolves.toBe(user);
    expect(state.resolveEffectiveRequestHost).not.toHaveBeenCalled();
  }, 15_000);

  it('keeps non-tenant requests unchanged when the user has no instance context', async () => {
    state.classifyHost.mockReturnValueOnce({ kind: 'root' });

    const { resolveSessionUser } = await import('./middleware-hosts.js');
    const user = { id: 'user-2' };

    await expect(resolveSessionUser(new Request('https://root.example.test'), user as never)).resolves.toEqual(user);
    expect(state.logger.warn).not.toHaveBeenCalled();
  });

  it('throws a hydration error for tenant requests without an instance id', async () => {
    const { resolveSessionUser } = await import('./middleware-hosts.js');

    await expect(resolveSessionUser(new Request('https://tenant.example.test/app'), { id: 'user-3' } as never)).rejects
      .toMatchObject({
        name: 'SessionUserHydrationError',
        reason: 'missing_instance_id',
        requestHost: 'tenant.example.test',
      });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'Auth middleware rejected tenant request because the session user lacks instance context',
      expect.objectContaining({
        tenant_host: 'tenant.example.test',
        user_id: 'user-3',
        trace_id: 'trace-1',
      })
    );
  });

  it('skips tenant validation when no instance config is available or the host is not tenant scoped', async () => {
    const { validateTenantHost } = await import('./middleware-hosts.js');

    state.getInstanceConfig.mockReturnValueOnce(null);
    await expect(validateTenantHost(new Request('https://root.example.test'))).resolves.toBeNull();

    state.classifyHost.mockReturnValueOnce({ kind: 'root' });
    await expect(validateTenantHost(new Request('https://root.example.test'))).resolves.toBeNull();

    expect(state.loadInstanceByHostname).not.toHaveBeenCalled();
  });

  it('returns a database_unavailable error when tenant lookup fails', async () => {
    state.loadInstanceByHostname.mockRejectedValueOnce(new Error('db down'));

    const { validateTenantHost } = await import('./middleware-hosts.js');
    const response = await validateTenantHost(new Request('https://tenant.example.test/path'));

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        details: {
          reason_code: 'tenant_lookup_failed',
          dependency: 'database',
        },
      },
      requestId: 'req-1',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Auth middleware failed to load tenant host from registry',
      expect.objectContaining({
        tenant_host: 'tenant.example.test',
        reason_code: 'tenant_lookup_failed',
      })
    );
  });

  it('rejects missing or inactive tenant hosts with explicit reason codes', async () => {
    const { validateTenantHost } = await import('./middleware-hosts.js');

    state.loadInstanceByHostname.mockResolvedValueOnce(null);
    const missing = await validateTenantHost(new Request('https://tenant.example.test/path'));
    expect(missing?.status).toBe(403);
    await expect(missing?.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        details: { reason_code: 'tenant_not_found' },
      },
    });

    state.loadInstanceByHostname.mockResolvedValueOnce({
      instanceId: 'instance-2',
      status: 'archived',
    });
    state.isTrafficEnabledInstanceStatus.mockReturnValueOnce(false);
    const inactive = await validateTenantHost(new Request('https://tenant.example.test/path'));
    expect(inactive?.status).toBe(403);
    await expect(inactive?.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        details: {
          reason_code: 'tenant_inactive',
          instance_id: 'instance-2',
        },
      },
    });
  });

  it('accepts active tenant hosts', async () => {
    state.loadInstanceByHostname.mockResolvedValueOnce({
      instanceId: 'instance-3',
      status: 'active',
    });
    state.isTrafficEnabledInstanceStatus.mockReturnValueOnce(true);

    const { validateTenantHost } = await import('./middleware-hosts.js');
    await expect(validateTenantHost(new Request('https://tenant.example.test/path'))).resolves.toBeNull();
  });
});
