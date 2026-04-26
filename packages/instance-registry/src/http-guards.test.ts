import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryHttpGuards, INSTANCE_REGISTRY_HTTP_ADMIN_ROLE } from './http-guards.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('http guards', () => {
  const deps = {
    getRequestId: vi.fn(() => 'req-guards'),
    createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ code, message, requestId }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    isRootHostRequest: vi.fn(() => true),
    requireRoles: vi.fn(() => null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.getRequestId.mockReturnValue('req-guards');
    deps.isRootHostRequest.mockReturnValue(true);
    deps.requireRoles.mockReturnValue(null);
  });

  it('allows root-host requests through the registry admin role check', () => {
    const guards = createInstanceRegistryHttpGuards(deps);
    const ctx = { userId: 'u-1' };

    const response = guards.ensurePlatformAccess(new Request('https://studio.example.org/api/instances'), ctx);

    expect(response).toBeNull();
    expect(deps.requireRoles).toHaveBeenCalledWith(ctx, new Set([INSTANCE_REGISTRY_HTTP_ADMIN_ROLE]), 'req-guards');
  });

  it('rejects tenant-host requests before role checks', async () => {
    deps.isRootHostRequest.mockReturnValueOnce(false);
    const guards = createInstanceRegistryHttpGuards(deps);

    const response = guards.ensurePlatformAccess(
      new Request('https://tenant.studio.example.org/api/instances'),
      { userId: 'u-1' }
    );

    expect(response?.status).toBe(403);
    expect(deps.requireRoles).not.toHaveBeenCalled();
    await expect(readBody(response as Response)).resolves.toMatchObject({
      code: 'forbidden',
      requestId: 'req-guards',
    });
  });

  it('requires explicit fresh reauth confirmation for mutations', () => {
    const guards = createInstanceRegistryHttpGuards(deps);

    expect(guards.requireFreshReauth(new Request('https://studio.example.org/api/instances'))?.status).toBe(403);
    expect(
      guards.requireFreshReauth(
        new Request('https://studio.example.org/api/instances', {
          headers: { 'x-sva-reauth-confirmed': 'TRUE' },
        })
      )
    ).toBeNull();
  });
});
