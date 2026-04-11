import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  requestId: 'req-test',
  ensurePlatformAccess: vi.fn(() => null),
  validateCsrf: vi.fn(() => null),
  requireFreshReauth: vi.fn(() => null),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  readDetailInstanceId: vi.fn(() => 'inst-1'),
  parseRequestBody: vi.fn(async () => ({ ok: true, data: { rotateClientSecret: false, intent: 'provision' } })),
  withRegistryService: vi.fn(async (work: (service: any) => unknown) =>
    work({
      reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
      executeKeycloakProvisioning: vi.fn(async () => ({ id: 'run-1' })),
      changeStatus: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', status: 'active' } })),
    })
  ),
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => ({ requestId: state.requestId }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (data: unknown) => data,
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ code, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  parseRequestBody: (...args: unknown[]) => state.parseRequestBody(...args),
  requireIdempotencyKey: (...args: unknown[]) => state.requireIdempotencyKey(...args),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: (...args: unknown[]) => state.validateCsrf(...args),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: (...args: unknown[]) => state.ensurePlatformAccess(...args),
  executeKeycloakProvisioningSchema: {},
  readDetailInstanceId: (...args: unknown[]) => state.readDetailInstanceId(...args),
  reconcileKeycloakSchema: {},
  requireFreshReauth: (...args: unknown[]) => state.requireFreshReauth(...args),
  statusMutationSchema: {},
}));

vi.mock('./repository.js', () => ({
  withRegistryService: (...args: unknown[]) => state.withRegistryService(...args),
}));

import {
  executeInstanceKeycloakProvisioningMutation,
  mapInstanceMutationError,
  mutateInstanceStatus,
  reconcileInstanceKeycloakMutation,
} from './core-mutations.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('core-mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ensurePlatformAccess.mockReturnValue(null);
    state.validateCsrf.mockReturnValue(null);
    state.requireFreshReauth.mockReturnValue(null);
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.readDetailInstanceId.mockReturnValue('inst-1');
    state.parseRequestBody.mockResolvedValue({ ok: true, data: { rotateClientSecret: false, intent: 'provision' } });
    state.withRegistryService.mockImplementation(async (work: (service: any) => unknown) =>
      work({
        reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
        executeKeycloakProvisioning: vi.fn(async () => ({ id: 'run-1' })),
        changeStatus: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', status: 'active' } })),
      })
    );
  });

  it('maps known mutation errors to tenant secret conflict', async () => {
    const response = mapInstanceMutationError(new Error('tenant_auth_client_secret_missing')); 
    const body = await readBody(response);
    expect(response.status).toBe(409);
    expect(body.code).toBe('tenant_auth_client_secret_missing');
  });

  it('maps encryption bootstrap errors to 503', async () => {
    const response = mapInstanceMutationError(new Error('pii_encryption_required_not_ready'));
    const body = await readBody(response);
    expect(response.status).toBe(503);
    expect(body.code).toBe('encryption_not_configured');
  });

  it('maps unknown mutation errors to keycloak_unavailable', async () => {
    const response = mapInstanceMutationError(new Error('boom'));
    const body = await readBody(response);
    expect(response.status).toBe(502);
    expect(body.code).toBe('keycloak_unavailable');
  });

  it('reconcileInstanceKeycloakMutation returns guard errors early', async () => {
    state.ensurePlatformAccess.mockReturnValue(new Response('forbidden', { status: 403 }));

    const response = await reconcileInstanceKeycloakMutation(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    expect(response.status).toBe(403);
    expect(state.parseRequestBody).not.toHaveBeenCalled();
  });

  it('reconcileInstanceKeycloakMutation validates payload and returns 400 on invalid body', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: false, message: 'invalid' });

    const response = await reconcileInstanceKeycloakMutation(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('executeInstanceKeycloakProvisioningMutation returns not_found when run is missing', async () => {
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ executeKeycloakProvisioning: vi.fn(async () => null) })
    );

    const response = await executeInstanceKeycloakProvisioningMutation(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never
    );

    const body = await readBody(response);
    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('mutateInstanceStatus returns conflict when state transition is denied', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: true, data: { status: 'active' } });
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ changeStatus: vi.fn(async () => ({ ok: false, reason: 'conflict' })) })
    );

    const response = await mutateInstanceStatus(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never,
      'active'
    );

    const body = await readBody(response);
    expect(response.status).toBe(409);
    expect(body.code).toBe('conflict');
  });

  it('mutateInstanceStatus returns success payload when transition succeeds', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: true, data: { status: 'suspended' } });
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ changeStatus: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', status: 'suspended' } })) })
    );

    const response = await mutateInstanceStatus(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never,
      'suspended'
    );

    const body = await readBody(response);
    expect(response.status).toBe(200);
    expect(body.status).toBe('suspended');
  });
});
