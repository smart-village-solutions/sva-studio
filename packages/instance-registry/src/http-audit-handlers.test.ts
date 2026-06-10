import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryAuditHttpHandlers } from './http-audit-handlers.js';
import type { InstanceRegistryService } from './service-types.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('http-audit-handlers', () => {
  const ctx = { user: { id: 'admin-1' } };
  const service = {
    getInstanceDetail: vi.fn(async () => ({ instanceId: 'demo' })),
    runInstanceAudit: vi.fn(async () => ({
      generatedAt: '2026-06-10T12:00:00.000Z',
      includeOnlyActive: true,
      targetInstanceIds: ['demo'],
      overallStatus: 'pass',
      summary: { totalInstances: 1, passCount: 1, failCount: 0, warnCount: 0, skipCount: 0 },
      checks: [],
      instances: [],
    })),
  } as unknown as InstanceRegistryService;

  const deps = {
    getRequestId: vi.fn(() => 'req-1'),
    createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ code, message, requestId }), { status })
    ),
    jsonResponse: vi.fn((status: number, value: unknown) =>
      new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
    ),
    asApiItem: vi.fn((value: unknown) => value),
    mapReadError: vi.fn(() => new Response(JSON.stringify({ code: 'mapped' }), { status: 502 })),
    ensurePlatformAccess: vi.fn(() => null),
    withRegistryService: vi.fn(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    ),
    getActorId: vi.fn((value: typeof ctx) => value.user.id),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.ensurePlatformAccess.mockReturnValue(null);
    deps.withRegistryService.mockImplementation(async (work: (registryService: InstanceRegistryService) => Promise<unknown>) =>
      work(service)
    );
  });

  it('returns an aggregated audit run for the collection endpoint', async () => {
    const handlers = createInstanceRegistryAuditHttpHandlers(deps);

    const response = await handlers.getInstanceAuditRun(
      new Request('https://studio.example.org/api/v1/iam/instances/audit?instanceId=demo&includeOnlyActive=false'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(await readBody(response)).toMatchObject({
      includeOnlyActive: true,
      overallStatus: 'pass',
    });
    expect(service.runInstanceAudit).toHaveBeenCalledWith({
      instanceIds: ['demo'],
      includeOnlyActive: false,
      actorId: 'admin-1',
      requestId: 'req-1',
    });
  });

  it('returns 404 for unknown single-instance audit targets', async () => {
    const handlers = createInstanceRegistryAuditHttpHandlers(deps);
    vi.mocked(service.getInstanceDetail).mockResolvedValueOnce(null);

    const response = await handlers.getSingleInstanceAuditRun(
      new Request('https://studio.example.org/api/v1/iam/instances/demo/audit'),
      ctx
    );

    expect(response.status).toBe(404);
    expect(await readBody(response)).toMatchObject({ code: 'not_found' });
    expect(service.runInstanceAudit).not.toHaveBeenCalled();
  });

  it('rejects invalid includeOnlyActive query parameters', async () => {
    const handlers = createInstanceRegistryAuditHttpHandlers(deps);

    const response = await handlers.getInstanceAuditRun(
      new Request('https://studio.example.org/api/v1/iam/instances/audit?includeOnlyActive=maybe'),
      ctx
    );

    expect(response.status).toBe(400);
    expect(await readBody(response)).toMatchObject({ code: 'invalid_request' });
  });
});
