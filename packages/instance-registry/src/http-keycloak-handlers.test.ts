import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryKeycloakHttpHandlers } from './http-keycloak-handlers.js';
import type { InstanceRegistryService } from './service-types.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('http-keycloak-handlers', () => {
  const ctx = { userId: 'admin-1' };
  const service = {
    getKeycloakStatus: vi.fn(async () => ({ realmExists: true })),
    getKeycloakPreflight: vi.fn(async () => ({ overallStatus: 'ready', checks: [] })),
    planKeycloakProvisioning: vi.fn(async () => ({ overallStatus: 'ready', driftSummary: 'ok' })),
    getKeycloakProvisioningRun: vi.fn(async () => ({ id: 'run-1', overallStatus: 'planned' })),
  } as unknown as InstanceRegistryService;

  const deps = {
    getRequestId: vi.fn(() => 'req-1'),
    createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ code, message, requestId }), { status })
    ),
    jsonResponse: vi.fn((status: number, value: unknown) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    asApiItem: vi.fn((value: unknown) => value),
    mapMutationError: vi.fn(() => new Response(JSON.stringify({ code: 'mapped' }), { status: 502 })),
    ensurePlatformAccess: vi.fn(() => null),
    validateCsrf: vi.fn(() => null),
    requireFreshReauth: vi.fn(() => null),
    withRegistryService: vi.fn(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.getRequestId.mockReturnValue('req-1');
    deps.ensurePlatformAccess.mockReturnValue(null);
    deps.validateCsrf.mockReturnValue(null);
    deps.requireFreshReauth.mockReturnValue(null);
    deps.withRegistryService.mockImplementation(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    );
    vi.mocked(service.getKeycloakStatus).mockResolvedValue({ realmExists: true } as never);
    vi.mocked(service.getKeycloakPreflight).mockResolvedValue({ overallStatus: 'ready', checks: [] } as never);
    vi.mocked(service.planKeycloakProvisioning).mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' } as never);
    vi.mocked(service.getKeycloakProvisioningRun).mockResolvedValue({ id: 'run-1', overallStatus: 'planned' } as never);
  });

  it('returns keycloak status payloads through injected response adapters', async () => {
    const handlers = createInstanceRegistryKeycloakHttpHandlers(deps);

    const response = await handlers.getInstanceKeycloakStatus(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/status'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(await readBody(response)).toEqual({ realmExists: true });
    expect(service.getKeycloakStatus).toHaveBeenCalledWith('demo');
  });

  it('applies mutation guards for the plan endpoint', async () => {
    const handlers = createInstanceRegistryKeycloakHttpHandlers(deps);
    deps.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 403 }));

    const response = await handlers.planInstanceKeycloakProvisioning(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/plan'),
      ctx
    );

    expect(response.status).toBe(403);
    expect(deps.withRegistryService).not.toHaveBeenCalled();
  });

  it('returns not_found when a provisioning run is missing', async () => {
    const handlers = createInstanceRegistryKeycloakHttpHandlers(deps);
    vi.mocked(service.getKeycloakProvisioningRun).mockResolvedValueOnce(null);

    const response = await handlers.getInstanceKeycloakProvisioningRun(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/runs/run-1'),
      ctx
    );

    expect(response.status).toBe(404);
    expect(await readBody(response)).toMatchObject({ code: 'not_found' });
  });

  it('maps read errors through the injected mutation error mapper', async () => {
    const handlers = createInstanceRegistryKeycloakHttpHandlers(deps);
    const thrown = new Error('backend down');
    deps.withRegistryService.mockImplementationOnce(async () => {
      throw thrown;
    });

    const response = await handlers.getInstanceKeycloakProvisioningRun(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/keycloak/runs/run-1'),
      ctx
    );

    expect(response.status).toBe(502);
    expect(deps.mapMutationError).toHaveBeenCalledWith(thrown);
  });
});
