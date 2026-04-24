import { beforeEach, describe, expect, it, vi } from 'vitest';

const createApiErrorMock = vi.hoisted(() =>
  vi.fn(
  (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: code, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);
const requireRolesMock = vi.hoisted(() => vi.fn());
const isCanonicalAuthHostMock = vi.hoisted(() => vi.fn());

vi.mock('../iam-account-management/api-helpers.js', () => ({
  createApiError: createApiErrorMock,
}));

vi.mock('../iam-account-management/shared-actor-resolution.js', () => ({
  requireRoles: requireRolesMock,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'req-http' }),
  isCanonicalAuthHost: isCanonicalAuthHostMock,
}));

import {
  createInstanceSchema,
  ensurePlatformAccess,
  readDetailInstanceId,
  readKeycloakRunId,
  requireFreshReauth,
} from './http.js';

describe('iam-instance-registry http helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCanonicalAuthHostMock.mockReturnValue(true);
    requireRolesMock.mockReturnValue(null);
  });

  it('allows root-host requests and delegates role enforcement', () => {
    const request = new Request('https://studio.example.org/api/v1/iam/instances');
    const ctx = { user: { id: 'user-1', roles: ['instance_registry_admin'] } };

    const response = ensurePlatformAccess(request, ctx as never);

    expect(response).toBeNull();
    expect(requireRolesMock).toHaveBeenCalledWith(ctx, new Set(['instance_registry_admin']), 'req-http');
  });

  it('rejects tenant-host requests before role checks', async () => {
    isCanonicalAuthHostMock.mockReturnValue(false);

    const response = ensurePlatformAccess(
      new Request('https://hb.studio.example.org/api/v1/iam/instances'),
      { user: { id: 'user-1', roles: ['instance_registry_admin'] } } as never
    );

    expect(requireRolesMock).not.toHaveBeenCalled();
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'forbidden',
      requestId: 'req-http',
    });
  });

  it('requires a fresh reauth header for mutations', async () => {
    expect(requireFreshReauth(new Request('https://studio.example.org/api/v1/iam/instances'))?.status).toBe(403);
    expect(
      requireFreshReauth(
        new Request('https://studio.example.org/api/v1/iam/instances', {
          headers: { 'x-sva-reauth-confirmed': 'TRUE' },
        })
      )
    ).toBeNull();
  });

  it('extracts detail instance ids from nested routes', () => {
    expect(
      readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/instances/demo/activate'))
    ).toBe('demo');
    expect(readDetailInstanceId(new Request('https://studio.example.org/api/v1/iam/users'))).toBeUndefined();
  });

  it('rejects invalid authIssuerUrl via optionalUrlSchema', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      authIssuerUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });

  it('allows create requests without a tenant admin client contract', () => {
    const result = createInstanceSchema.safeParse({
      instanceId: 'de-test',
      displayName: 'Demo',
      parentDomain: 'studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
    });

    expect(result.success).toBe(true);
  });

  it('extracts keycloak run ids from nested run routes', () => {
    const request = new Request(
      'https://studio.example.org/api/v1/iam/instances/de-test/keycloak/runs/run-42'
    );

    expect(readKeycloakRunId(request)).toBe('run-42');
  });

  it('returns undefined when keycloak run segment is missing', () => {
    const request = new Request('https://studio.example.org/api/v1/iam/instances/de-test/keycloak');

    expect(readKeycloakRunId(request)).toBeUndefined();
  });
});
