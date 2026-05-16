import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  afterEach(() => {
    vi.unstubAllEnvs();
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

    expect(
      guards.requireFreshReauth(new Request('https://studio.example.org/api/instances'), {
        freshReauthAt: Date.now() - 11 * 60 * 1000,
      })?.status
    ).toBe(403);
    expect(
      guards.requireFreshReauth(
        new Request('https://studio.example.org/api/instances'),
        {
          freshReauthAt: Date.now(),
        }
      )
    ).toBeNull();
  });

  it('ignores client-side headers without server-side fresh reauth evidence', () => {
    const guards = createInstanceRegistryHttpGuards(deps);

    const response = guards.requireFreshReauth(
      new Request('https://studio.example.org/api/instances', {
        headers: { 'x-sva-reauth-confirmed': 'true' },
      }),
      {}
    );

    expect(response?.status).toBe(403);
  });

  it('allows documented local development bypasses', () => {
    const guards = createInstanceRegistryHttpGuards(deps);

    expect(
      guards.requireFreshReauth(new Request('https://studio.example.org/api/instances'), {
        isLocalDevelopmentAuth: true,
      })
    ).toBeNull();
  });

  it('keeps the local development bypass fail-closed', () => {
    const guards = createInstanceRegistryHttpGuards(deps);

    const response = guards.requireFreshReauth(new Request('https://studio.example.org/api/instances'), {
      isLocalDevelopmentAuth: 'true' as unknown as boolean,
    });

    expect(response?.status).toBe(403);
  });

  it('rejects invalid or future fresh reauth timestamps', () => {
    const guards = createInstanceRegistryHttpGuards(deps);
    const request = new Request('https://studio.example.org/api/instances');

    expect(guards.requireFreshReauth(request, { freshReauthAt: Number.POSITIVE_INFINITY })?.status).toBe(403);
    expect(guards.requireFreshReauth(request, { freshReauthAt: Number.NaN })?.status).toBe(403);
    expect(guards.requireFreshReauth(request, { freshReauthAt: Date.now() + 1_000 })?.status).toBe(403);
  });

  it('reads positive fresh reauth windows from the runtime environment', () => {
    vi.stubEnv('SVA_AUTH_FRESH_REAUTH_WINDOW_MS', '1000');
    const guards = createInstanceRegistryHttpGuards(deps);
    const request = new Request('https://studio.example.org/api/instances');

    expect(guards.requireFreshReauth(request, { freshReauthAt: Date.now() - 500 })).toBeNull();
    expect(guards.requireFreshReauth(request, { freshReauthAt: Date.now() - 1_500 })?.status).toBe(403);
  });
});
