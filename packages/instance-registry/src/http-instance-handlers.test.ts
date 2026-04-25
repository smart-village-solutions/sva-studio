import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createInstanceRegistryHttpHandlers } from './http-instance-handlers.js';
import type { InstanceRegistryService } from './service-types.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('http-instance-handlers', () => {
  const ctx = { user: { id: 'admin-1' } };
  const service = {
    listInstances: vi.fn(async () => [{ instanceId: 'demo', status: 'active' }]),
    getInstanceDetail: vi.fn(async () => ({ instanceId: 'demo', status: 'active' })),
    createProvisioningRequest: vi.fn(async () => ({ ok: true, instance: { instanceId: 'demo', status: 'validated' } })),
    updateInstance: vi.fn(async () => ({ instanceId: 'demo', status: 'active' })),
  } as unknown as InstanceRegistryService;

  const deps = {
    getRequestId: vi.fn(() => 'req-1'),
    getActor: vi.fn((context: typeof ctx) => ({ id: context.user.id })),
    createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ code, message, requestId }), { status })
    ),
    jsonResponse: vi.fn((status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    asApiItem: vi.fn((value: unknown) => value),
    asApiList: vi.fn((value: readonly unknown[], pagination: unknown, requestId?: string) => ({
      data: value,
      pagination,
      requestId,
    })),
    parseRequestBody: vi.fn(async () => ({ ok: true, data: {} })),
    requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
    mapMutationError: vi.fn(() => new Response(JSON.stringify({ code: 'mapped' }), { status: 502 })),
    ensurePlatformAccess: vi.fn(() => null),
    validateCsrf: vi.fn(() => null),
    requireFreshReauth: vi.fn(() => null),
    withRegistryService: vi.fn(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    ),
    onInstanceProvisioningRequested: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.getRequestId.mockReturnValue('req-1');
    deps.ensurePlatformAccess.mockReturnValue(null);
    deps.validateCsrf.mockReturnValue(null);
    deps.requireFreshReauth.mockReturnValue(null);
    deps.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    deps.parseRequestBody.mockResolvedValue({ ok: true, data: {} });
    deps.withRegistryService.mockImplementation(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    );
    vi.mocked(service.listInstances).mockResolvedValue([{ instanceId: 'demo', status: 'active' }] as never);
    vi.mocked(service.getInstanceDetail).mockResolvedValue({ instanceId: 'demo', status: 'active' } as never);
    vi.mocked(service.createProvisioningRequest).mockResolvedValue({
      ok: true,
      instance: { instanceId: 'demo', status: 'validated' },
    } as never);
    vi.mocked(service.updateInstance).mockResolvedValue({ instanceId: 'demo', status: 'active' } as never);
  });

  it('lists instances with pagination metadata', async () => {
    const handlers = createInstanceRegistryHttpHandlers(deps);
    const response = await handlers.listInstances(
      new Request('https://studio.example.org/api/v1/iam/instances?status=active'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(await readBody(response)).toMatchObject({
      data: [{ instanceId: 'demo', status: 'active' }],
      pagination: { page: 1, pageSize: 1, total: 1 },
    });
  });

  it('creates instances and emits the provisioning hook', async () => {
    deps.parseRequestBody.mockResolvedValueOnce({
      ok: true,
      data: {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'Studio.Example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      },
    });
    const handlers = createInstanceRegistryHttpHandlers(deps);
    const response = await handlers.createInstance(
      new Request('https://studio.example.org/api/v1/iam/instances', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(201);
    expect(service.createProvisioningRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        actorId: 'admin-1',
        parentDomain: 'Studio.Example.org',
      })
    );
    expect(deps.onInstanceProvisioningRequested).toHaveBeenCalledWith({
      instanceId: 'demo',
      primaryHostname: 'demo.studio.example.org',
      actorId: 'admin-1',
    });
  });

  it('maps update errors through the injected mapper', async () => {
    const thrown = new Error('tenant_auth_client_secret_missing');
    vi.mocked(service.updateInstance).mockRejectedValueOnce(thrown);
    deps.parseRequestBody.mockResolvedValueOnce({
      ok: true,
      data: {
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      },
    });

    const handlers = createInstanceRegistryHttpHandlers(deps);
    const response = await handlers.updateInstance(
      new Request('https://studio.example.org/api/v1/iam/instances/demo', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(502);
    expect(deps.mapMutationError).toHaveBeenCalledWith(thrown);
  });
});
