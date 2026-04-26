import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const createApiErrorMock = vi.hoisted(() =>
  vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: code, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);
const asApiListMock = vi.hoisted(() => vi.fn((data, pagination, requestId) => ({ data, pagination, requestId })));
const asApiItemMock = vi.hoisted(() => vi.fn((data, requestId) => ({ data, requestId })));
const parseRequestBodyMock = vi.hoisted(() => vi.fn());
const requireIdempotencyKeyMock = vi.hoisted(() => vi.fn());
const validateCsrfMock = vi.hoisted(() => vi.fn());
const jsonResponseMock = vi.hoisted(() =>
  vi.fn((status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);
const buildLogContextMock = vi.hoisted(() => vi.fn(() => ({ trace_id: 'trace-1' })));
const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
const withRegistryServiceMock = vi.hoisted(() => vi.fn());
const ensurePlatformAccessMock = vi.hoisted(() => vi.fn());
const requireFreshReauthMock = vi.hoisted(() => vi.fn());
const readDetailInstanceIdMock = vi.hoisted(() => vi.fn());
const workspaceContext = vi.hoisted(() => ({ requestId: 'req-core' }));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: asApiItemMock,
  asApiList: asApiListMock,
  createApiError: createApiErrorMock,
  parseRequestBody: parseRequestBodyMock,
  requireIdempotencyKey: requireIdempotencyKeyMock,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: validateCsrfMock,
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: jsonResponseMock,
}));

vi.mock('../shared/log-context.js', () => ({
  buildLogContext: buildLogContextMock,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => loggerMock,
  getWorkspaceContext: () => workspaceContext,
}));

vi.mock('./repository.js', () => ({
  withRegistryService: withRegistryServiceMock,
}));

vi.mock('./http.js', () => ({
  createInstanceSchema: z.object({
    instanceId: z.string(),
    displayName: z.string(),
    parentDomain: z.string(),
    authRealm: z.string(),
    authClientId: z.string(),
    authIssuerUrl: z.string().optional(),
    themeKey: z.string().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
    mainserverConfigRef: z.string().optional(),
  }),
  ensurePlatformAccess: ensurePlatformAccessMock,
  listQuerySchema: z.object({
    search: z.string().optional(),
    status: z.enum(['requested', 'validated', 'provisioning', 'active', 'failed', 'suspended', 'archived']).optional(),
  }),
  reconcileKeycloakSchema: z.object({
    tenantAdminTemporaryPassword: z.string().optional(),
    rotateClientSecret: z.boolean().optional(),
  }),
  readDetailInstanceId: readDetailInstanceIdMock,
  requireFreshReauth: requireFreshReauthMock,
  statusMutationSchema: z.object({
    status: z.enum(['active', 'suspended', 'archived']),
  }),
  updateInstanceSchema: z.object({
    displayName: z.string(),
    parentDomain: z.string(),
    authRealm: z.string(),
    authClientId: z.string(),
    authIssuerUrl: z.string().optional(),
    authClientSecret: z.string().optional(),
    tenantAdminBootstrap: z.any().optional(),
    themeKey: z.string().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
    mainserverConfigRef: z.string().optional(),
  }),
}));

import {
  activateInstanceInternal,
  archiveInstanceInternal,
  createInstanceInternal,
  getInstanceInternal,
  listInstancesInternal,
  suspendInstanceInternal,
  updateInstanceInternal,
} from './core.js';
import { getInstanceKeycloakStatusInternal, reconcileInstanceKeycloakInternal } from './core-keycloak.js';
import { createTenantForbiddenResponse, isInstanceTrafficAllowed, resolveRuntimeInstanceFromRequest } from './core-runtime.js';

describe('iam-instance-registry core handlers', () => {
  const ctx = { user: { id: 'admin-1' } } as never;
  const service = {
    listInstances: vi.fn(),
    getInstanceDetail: vi.fn(),
    createProvisioningRequest: vi.fn(),
    updateInstance: vi.fn(),
    changeStatus: vi.fn(),
    getKeycloakStatus: vi.fn(),
    reconcileKeycloak: vi.fn(),
    resolveRuntimeInstance: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ensurePlatformAccessMock.mockReturnValue(null);
    validateCsrfMock.mockReturnValue(null);
    requireFreshReauthMock.mockReturnValue(null);
    requireIdempotencyKeyMock.mockReturnValue({ key: 'idem-1' });
    parseRequestBodyMock.mockResolvedValue({ ok: true, data: {} });
    readDetailInstanceIdMock.mockReturnValue('demo');
    withRegistryServiceMock.mockImplementation(async (work) => work(service));
  });

  it('lists instances and rejects invalid filters', async () => {
    service.listInstances.mockResolvedValueOnce([{ instanceId: 'hb', status: 'active' }]);
    const success = await listInstancesInternal(
      new Request('https://studio.example.org/api/v1/iam/instances?search=hb&status=active'),
      ctx
    );

    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toMatchObject({
      data: [{ instanceId: 'hb', status: 'active' }],
      requestId: 'req-core',
    });

    const invalid = await listInstancesInternal(
      new Request('https://studio.example.org/api/v1/iam/instances?status=bogus'),
      ctx
    );

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: 'invalid_request' });
  });

  it('reports pageSize 0 for empty instance lists', async () => {
    service.listInstances.mockResolvedValueOnce([]);

    const response = await listInstancesInternal(
      new Request('https://studio.example.org/api/v1/iam/instances'),
      ctx
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 1,
        pageSize: 0,
        total: 0,
      },
    });
  });

  it('returns platform access errors for list and detail handlers', async () => {
    ensurePlatformAccessMock.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const list = await listInstancesInternal(
      new Request('https://studio.example.org/api/v1/iam/instances'),
      ctx
    );

    ensurePlatformAccessMock.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const detail = await getInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo'),
      ctx
    );

    expect(list.status).toBe(403);
    expect(detail.status).toBe(403);
  });

  it('returns detail responses and handles missing instances', async () => {
    service.getInstanceDetail.mockResolvedValueOnce({ instanceId: 'demo', status: 'active' }).mockResolvedValueOnce(null);

    const found = await getInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo'),
      ctx
    );
    const missingId = await getInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances'),
      ctx
    );
    readDetailInstanceIdMock.mockReturnValueOnce('missing');
    const missing = await getInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/missing'),
      ctx
    );

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({ data: { instanceId: 'demo' } });
    expect(missingId.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it('creates instances, logs successful provisioning, and handles conflicts', async () => {
    parseRequestBodyMock.mockResolvedValue({
      ok: true,
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'Studio.Example.org',
        authRealm: 'demo-realm',
        authClientId: 'sva-studio',
        themeKey: 'modern',
        featureFlags: { beta: true },
      },
    });
    service.createProvisioningRequest
      .mockResolvedValueOnce({ ok: true, instance: { instanceId: 'demo', status: 'validated' } })
      .mockResolvedValueOnce({ ok: false, reason: 'already_exists' });

    const created = await createInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances', { method: 'POST' }),
      ctx
    );
    const conflict = await createInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances', { method: 'POST' }),
      ctx
    );

    expect(created.status).toBe(201);
    expect(service.createProvisioningRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        actorId: 'admin-1',
        parentDomain: 'Studio.Example.org',
        authRealm: 'demo-realm',
        authClientId: 'sva-studio',
      })
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Instance provisioning requested',
      expect.objectContaining({
        operation: 'instance_create',
        instance_id: 'demo',
      })
    );
    expect(conflict.status).toBe(409);
  });

  it('short-circuits create requests on security and validation failures', async () => {
    ensurePlatformAccessMock.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    validateCsrfMock.mockReturnValueOnce(new Response('csrf', { status: 403 }));
    requireFreshReauthMock.mockReturnValueOnce(new Response('reauth', { status: 403 }));
    requireIdempotencyKeyMock.mockReturnValueOnce({ error: new Response('idem', { status: 400 }) });
    parseRequestBodyMock.mockResolvedValueOnce({ ok: false, message: 'kaputt' });

    expect(
      (await createInstanceInternal(new Request('https://studio.example.org/api/v1/iam/instances'), ctx)).status
    ).toBe(403);
    expect(
      (await createInstanceInternal(new Request('https://studio.example.org/api/v1/iam/instances'), ctx)).status
    ).toBe(403);
    expect(
      (await createInstanceInternal(new Request('https://studio.example.org/api/v1/iam/instances'), ctx)).status
    ).toBe(403);
    expect(
      (await createInstanceInternal(new Request('https://studio.example.org/api/v1/iam/instances'), ctx)).status
    ).toBe(400);
    expect(
      (await createInstanceInternal(new Request('https://studio.example.org/api/v1/iam/instances'), ctx)).status
    ).toBe(400);
    expect(service.createProvisioningRequest).not.toHaveBeenCalled();
  });

  it('handles instance status mutations across success and failure branches', async () => {
    parseRequestBodyMock.mockReset();
    parseRequestBodyMock
      .mockResolvedValueOnce({ ok: true, data: { status: 'active' } })
      .mockResolvedValueOnce({ ok: true, data: { status: 'active' } })
      .mockResolvedValueOnce({ ok: true, data: { status: 'active' } })
      .mockResolvedValueOnce({ ok: false, message: 'bad' });
    service.changeStatus
      .mockResolvedValueOnce({ ok: true, instance: { instanceId: 'demo', status: 'active' } })
      .mockResolvedValueOnce({ ok: false, reason: 'not_found' })
      .mockResolvedValueOnce({ ok: false, reason: 'invalid_transition' });

    const activated = await activateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/activate', { method: 'POST' }),
      ctx
    );
    const notFound = await activateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/activate', { method: 'POST' }),
      ctx
    );
    const conflict = await activateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/activate', { method: 'POST' }),
      ctx
    );
    const invalidBody = await suspendInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/suspend', { method: 'POST' }),
      ctx
    );
    readDetailInstanceIdMock.mockReturnValueOnce(undefined);
    parseRequestBodyMock.mockResolvedValueOnce({ ok: true, data: { status: 'archived' } });
    const missingId = await archiveInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/archive', { method: 'POST' }),
      ctx
    );

    expect(activated.status).toBe(200);
    expect(notFound.status).toBe(404);
    expect(conflict.status).toBe(409);
    expect(invalidBody.status).toBe(400);
    expect(missingId.status).toBe(400);
  });

  it('updates instances and exposes keycloak status endpoints', async () => {
    parseRequestBodyMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          displayName: 'Updated Demo',
          parentDomain: 'studio.example.org',
          authRealm: 'demo',
          authClientId: 'sva-studio',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          rotateClientSecret: true,
          tenantAdminTemporaryPassword: 'test-temp-password',
        },
      });
    service.updateInstance.mockResolvedValueOnce({ instanceId: 'demo', displayName: 'Updated Demo' });
    service.getKeycloakStatus.mockResolvedValueOnce({ realmExists: true });
    service.reconcileKeycloak.mockResolvedValueOnce({ realmExists: true, clientExists: true });

    const updated = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );
    const status = await getInstanceKeycloakStatusInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/status'),
      ctx
    );
    const reconcile = await reconcileInstanceKeycloakInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/reconcile', { method: 'POST' }),
      ctx
    );

    expect(updated.status).toBe(200);
    expect(status.status).toBe(200);
    expect(reconcile.status).toBe(200);
    expect(service.updateInstance).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'demo' }));
    expect(service.getKeycloakStatus).toHaveBeenCalledWith('demo');
    expect(service.reconcileKeycloak).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        tenantAdminTemporaryPassword: 'test-temp-password',
        rotateClientSecret: true,
      })
    );
  });

  it('maps instance mutation errors to stable API codes', async () => {
    parseRequestBodyMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          displayName: 'Updated Demo',
          parentDomain: 'studio.example.org',
          authRealm: 'demo',
          authClientId: 'sva-studio',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {},
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {},
      });
    service.updateInstance.mockRejectedValueOnce(new Error('tenant_auth_client_secret_missing'));
    service.getKeycloakStatus.mockRejectedValueOnce(new Error('pii_encryption_required:missing_key'));
    service.reconcileKeycloak.mockRejectedValueOnce(new Error('boom'));

    const update = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );
    const status = await getInstanceKeycloakStatusInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/status'),
      ctx
    );
    const reconcile = await reconcileInstanceKeycloakInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/reconcile', { method: 'POST' }),
      ctx
    );

    expect(update.status).toBe(409);
    await expect(update.json()).resolves.toMatchObject({ error: 'tenant_auth_client_secret_missing' });
    expect(status.status).toBe(503);
    await expect(status.json()).resolves.toMatchObject({ error: 'encryption_not_configured' });
    expect(reconcile.status).toBe(502);
    await expect(reconcile.json()).resolves.toMatchObject({ error: 'keycloak_unavailable' });
  });

  it('returns update guard errors in order and handles missing updates', async () => {
    ensurePlatformAccessMock.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const access = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );
    expect(access.status).toBe(403);

    ensurePlatformAccessMock.mockReturnValue(null);
    validateCsrfMock.mockReturnValueOnce(new Response('csrf', { status: 403 }));
    const csrf = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );
    expect(csrf.status).toBe(403);

    validateCsrfMock.mockReturnValue(null);
    requireFreshReauthMock.mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const reauth = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );
    expect(reauth.status).toBe(403);

    requireFreshReauthMock.mockReturnValue(null);

    parseRequestBodyMock.mockResolvedValueOnce({
      ok: true,
      data: {
        displayName: 'Updated Demo',
        parentDomain: 'studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      },
    });
    const missingId = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances', { method: 'PATCH' }),
      ctx
    );
    expect(missingId.status).toBe(400);

    parseRequestBodyMock.mockResolvedValueOnce({
      ok: true,
      data: {
        displayName: 'Updated Demo',
        parentDomain: 'studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      },
    });
    readDetailInstanceIdMock.mockReturnValueOnce('missing');
    service.updateInstance.mockResolvedValueOnce(null);
    const notFound = await updateInstanceInternal(
      new Request('https://studio.example.org/api/v1/iam/instances/missing', { method: 'PATCH' }),
      ctx
    );
    expect(notFound.status).toBe(404);
  });

  it('resolves runtime instances and exposes helper responses', async () => {
    service.resolveRuntimeInstance.mockResolvedValue({
      hostClassification: { kind: 'tenant', normalizedHost: 'demo.studio.example.org', instanceId: 'demo' },
      instance: { instanceId: 'demo', status: 'active' },
    });

    const resolved = await resolveRuntimeInstanceFromRequest(
      new Request('https://demo.studio.example.org/admin/instances')
    );

    expect(resolved).toEqual({
      hostClassification: { kind: 'tenant', normalizedHost: 'demo.studio.example.org', instanceId: 'demo' },
      instance: { instanceId: 'demo', status: 'active' },
    });
    expect(createTenantForbiddenResponse().status).toBe(403);
    expect(isInstanceTrafficAllowed('active')).toBe(true);
    expect(isInstanceTrafficAllowed('archived')).toBe(false);
  });
});
