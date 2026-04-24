import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from './types.js';

const loadInstanceByHostnameMock = vi.hoisted(() => vi.fn());
const workspaceContext = vi.hoisted(() => ({
  requestId: 'req-hosts',
}));
const instanceConfigState = vi.hoisted(() => ({
  value:
    {
      canonicalAuthHost: 'studio.smart-village.app',
      parentDomain: 'studio.smart-village.app',
    } as { canonicalAuthHost: string; parentDomain: string } | null,
}));
const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceByHostname: loadInstanceByHostnameMock,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => loggerMock,
  getInstanceConfig: () => instanceConfigState.value,
  getWorkspaceContext: () => workspaceContext,
}));

vi.mock('./shared/log-context.js', () => ({
  buildLogContext: () => ({ request_id: workspaceContext.requestId }),
}));

describe('middleware-hosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    instanceConfigState.value = {
      canonicalAuthHost: 'studio.smart-village.app',
      parentDomain: 'studio.smart-village.app',
    };
    workspaceContext.requestId = 'req-hosts';
  });

  it('rejects tenant requests without instanceId even when instance config is unavailable', async () => {
    instanceConfigState.value = null;
    const { resolveSessionUser } = await import('./middleware-hosts.js');

    const user = {
      id: 'user-1',
      roles: ['iam_admin'],
    } satisfies SessionUser;

    await expect(
      resolveSessionUser(
        new Request('https://hb-meinquartier.studio.smart-village.app/api/v1/iam/users'),
        user
      )
    ).rejects.toMatchObject({
      name: 'SessionUserHydrationError',
      reason: 'missing_instance_id',
      requestHost: 'hb-meinquartier.studio.smart-village.app',
    });
  });

  it('keeps IPv4 hosts in degraded mode on the platform path when instance config is unavailable', async () => {
    instanceConfigState.value = null;
    const { resolveSessionUser } = await import('./middleware-hosts.js');

    const user = {
      id: 'user-ipv4',
      roles: ['iam_admin'],
    } satisfies SessionUser;

    await expect(resolveSessionUser(new Request('http://127.0.0.1/api/v1/iam/users'), user)).resolves.toEqual(user);
  });

  it('includes the generated workspace request id in tenant host errors', async () => {
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'hb-meinquartier',
      status: 'suspended',
    });
    const { validateTenantHost } = await import('./middleware-hosts.js');

    const response = await validateTenantHost(
      new Request('https://hb-meinquartier.studio.smart-village.app/api/v1/iam/users')
    );

    expect(response).not.toBeNull();
    expect(response?.headers.get('x-request-id')).toBe('req-hosts');
    await expect(response?.json()).resolves.toEqual(
      expect.objectContaining({
        requestId: 'req-hosts',
        error: expect.objectContaining({
          details: expect.objectContaining({
            reason_code: 'tenant_inactive',
            instance_id: 'hb-meinquartier',
          }),
        }),
      })
    );
  });
});
