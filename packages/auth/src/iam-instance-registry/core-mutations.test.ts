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

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: state.requestId }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (data: unknown) => data,
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(JSON.stringify({ code, message, requestId, ...(details ? { details } : {}) }), {
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
const registryRequest = (): Request => new Request('http://localhost/api/instances/inst-1');

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

  it('maps provisioning drift blockers without reconcile sync metadata', async () => {
    const response = mapInstanceMutationError(
      new Error('registry_or_provisioning_drift_blocked:Tenant-Admin-Client fehlt')
    );
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('tenant_admin_client_not_configured');
    expect(body.details).toEqual({
      dependency: 'keycloak',
      reason_code: 'registry_or_provisioning_drift_blocked',
      drift_summary: 'Tenant-Admin-Client fehlt',
    });
  });

  it('preserves tenant auth secret blockers inside provisioning drift mapping', async () => {
    const response = mapInstanceMutationError(
      new Error(
        'registry_or_provisioning_drift_blocked:Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.'
      )
    );
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('tenant_auth_client_secret_missing');
    expect(body.details).toEqual({
      dependency: 'keycloak',
      reason_code: 'registry_or_provisioning_drift_blocked',
      drift_summary: 'Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.',
    });
  });

  it('maps unknown mutation errors to keycloak_unavailable', async () => {
    const response = mapInstanceMutationError(new Error('boom'));
    const body = await readBody(response);
    expect(response.status).toBe(502);
    expect(body.code).toBe('keycloak_unavailable');
  });

  it('reconcileInstanceKeycloakMutation returns guard errors early', async () => {
    state.ensurePlatformAccess.mockReturnValue(new Response('forbidden', { status: 403 }));

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);
    expect(response.status).toBe(403);
    expect(state.parseRequestBody).not.toHaveBeenCalled();
  });

  it('reconcileInstanceKeycloakMutation validates payload and returns 400 on invalid body', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: false, message: 'invalid' });

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('reconcileInstanceKeycloakMutation returns csrf error before body parsing', async () => {
    state.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 419 }));

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);

    expect(response.status).toBe(419);
    expect(state.parseRequestBody).not.toHaveBeenCalled();
  });

  it('reconcileInstanceKeycloakMutation returns reauth error', async () => {
    state.requireFreshReauth.mockReturnValueOnce(new Response('reauth', { status: 428 }));

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);

    expect(response.status).toBe(428);
  });

  it('reconcileInstanceKeycloakMutation returns idempotency error', async () => {
    state.requireIdempotencyKey.mockReturnValueOnce({ error: new Response('idem', { status: 400 }) });

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);

    expect(response.status).toBe(400);
  });

  it('reconcileInstanceKeycloakMutation returns 400 when instance id is missing', async () => {
    state.readDetailInstanceId.mockReturnValueOnce('');

    const response = await reconcileInstanceKeycloakMutation(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_instance_id');
  });

  it('reconcileInstanceKeycloakMutation returns 404 when service returns null', async () => {
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ reconcileKeycloak: vi.fn(async () => null) })
    );

    const response = await reconcileInstanceKeycloakMutation(registryRequest(), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('executeInstanceKeycloakProvisioningMutation returns invalid_instance_id when missing', async () => {
    state.readDetailInstanceId.mockReturnValueOnce('');

    const response = await executeInstanceKeycloakProvisioningMutation(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_instance_id');
  });

  it('executeInstanceKeycloakProvisioningMutation maps thrown errors via mutation mapper', async () => {
    state.withRegistryService.mockImplementationOnce(async () => {
      throw new Error('tenant_auth_client_secret_missing');
    });

    const response = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('tenant_auth_client_secret_missing');
  });

  it('executeInstanceKeycloakProvisioningMutation returns not_found when run is missing', async () => {
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ executeKeycloakProvisioning: vi.fn(async () => null) })
    );

    const response = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );

    const body = await readBody(response);
    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('executeInstanceKeycloakProvisioningMutation returns guard errors in order', async () => {
    state.ensurePlatformAccess.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const access = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    expect(access.status).toBe(403);

    state.ensurePlatformAccess.mockReturnValue(null);
    state.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 419 }));
    const csrf = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    expect(csrf.status).toBe(419);

    state.validateCsrf.mockReturnValue(null);
    state.requireFreshReauth.mockReturnValueOnce(new Response('reauth', { status: 428 }));
    const reauth = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    expect(reauth.status).toBe(428);

    state.requireFreshReauth.mockReturnValue(null);
    state.requireIdempotencyKey.mockReturnValueOnce({ error: new Response('idem', { status: 400 }) });
    const idem = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    expect(idem.status).toBe(400);

    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.parseRequestBody.mockResolvedValueOnce({ ok: false, message: 'invalid' });
    const invalid = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    const invalidBody = await readBody(invalid);
    expect(invalid.status).toBe(400);
    expect(invalidBody.code).toBe('invalid_request');
  });

  it('executeInstanceKeycloakProvisioningMutation returns success payload when run is created', async () => {
    state.parseRequestBody.mockResolvedValueOnce({
      ok: true,
      data: { intent: 'rotate_client_secret', tenantAdminTemporaryPassword: 'tmp-credential' },
    });
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ executeKeycloakProvisioning: vi.fn(async () => ({ id: 'run-2', overallStatus: 'planned' })) })
    );

    const response = await executeInstanceKeycloakProvisioningMutation(
      registryRequest(),
      { user: { id: 'u-1' } } as never
    );
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: 'run-2', overallStatus: 'planned' });
  });

  it('mutateInstanceStatus returns conflict when state transition is denied', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: true, data: { status: 'active' } });
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ changeStatus: vi.fn(async () => ({ ok: false, reason: 'conflict' })) })
    );

    const response = await mutateInstanceStatus(
      registryRequest(),
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
      registryRequest(),
      { user: { id: 'u-1' } } as never,
      'suspended'
    );

    const body = await readBody(response);
    expect(response.status).toBe(200);
    expect(body.status).toBe('suspended');
  });

  it('mutateInstanceStatus returns guard errors in order before mutation', async () => {
    state.ensurePlatformAccess.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const responseAccess = await mutateInstanceStatus(registryRequest(), { user: { id: 'u-1' } } as never, 'active');
    expect(responseAccess.status).toBe(403);

    state.ensurePlatformAccess.mockReturnValue(null);
    state.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 419 }));
    const responseCsrf = await mutateInstanceStatus(registryRequest(), { user: { id: 'u-1' } } as never, 'active');
    expect(responseCsrf.status).toBe(419);

    state.validateCsrf.mockReturnValue(null);
    state.requireFreshReauth.mockReturnValueOnce(new Response('reauth', { status: 428 }));
    const responseReauth = await mutateInstanceStatus(registryRequest(), { user: { id: 'u-1' } } as never, 'active');
    expect(responseReauth.status).toBe(428);
  });

  it('mutateInstanceStatus returns invalid_request for mismatched status payload', async () => {
    state.parseRequestBody.mockResolvedValueOnce({ ok: true, data: { status: 'archived' } });

    const response = await mutateInstanceStatus(
      registryRequest(),
      { user: { id: 'u-1' } } as never,
      'active'
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });
});
