import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  guardRequireFreshReauth: vi.fn(() => null),
}));

vi.mock('@sva/instance-registry/http-guards', () => ({
  createInstanceRegistryHttpGuards: vi.fn(() => ({
    ensurePlatformAccess: vi.fn(() => null),
    requireFreshReauth: mocks.guardRequireFreshReauth,
  })),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-http' })),
  isCanonicalAuthHost: vi.fn(() => true),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  createApiError: vi.fn(),
}));

vi.mock('../iam-account-management/shared-actor-resolution.js', () => ({
  requireRoles: vi.fn(() => null),
}));

vi.mock('../request-hosts.js', () => ({
  resolveEffectiveRequestHost: vi.fn(() => 'studio.example.org'),
}));

describe('iam instance registry http adapters', () => {
  it('forwards the authenticated context into the fresh reauth guard', async () => {
    const { requireFreshReauth } = await import('./http.js');
    const request = new Request('https://studio.example.org/api/v1/iam/instances');
    const ctx = { user: { id: 'admin-1' }, freshReauthAt: Date.now() };

    expect(requireFreshReauth(request, ctx as never)).toBeNull();
    expect(mocks.guardRequireFreshReauth).toHaveBeenCalledWith(request, ctx);
  });
});
