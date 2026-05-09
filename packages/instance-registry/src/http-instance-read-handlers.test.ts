import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGetInstanceHandler, createListInstancesHandler } from './http-instance-read-handlers.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('http-instance-read-handlers', () => {
  const ctx = { userId: 'admin-1' };
  const deps = {
    ensurePlatformAccess: vi.fn(() => null),
    createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ code, message, requestId }), { status })
    ),
    getRequestId: vi.fn(() => 'req-1'),
    withRegistryService: vi.fn(),
    jsonResponse: vi.fn((status: number, payload: unknown) => new Response(JSON.stringify(payload), { status })),
    asApiList: vi.fn((data: readonly unknown[], pagination: unknown, requestId?: string) => ({
      data,
      pagination,
      requestId,
    })),
    asApiItem: vi.fn((data: unknown, requestId?: string) => ({ data, requestId })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.ensurePlatformAccess.mockReturnValue(null);
    deps.getRequestId.mockReturnValue('req-1');
  });

  it('lists instances with validated filters and pagination metadata', async () => {
    deps.withRegistryService.mockImplementationOnce(async (work) =>
      work({
        listInstances: vi.fn().mockResolvedValue([{ instanceId: 'instance-1', status: 'active' }]),
      })
    );

    const handler = createListInstancesHandler(deps as never);
    const response = await handler(
      new Request('https://studio.example.test/api/v1/iam/instances?search=demo&status=active'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.withRegistryService).toHaveBeenCalled();
    await expect(readBody(response)).resolves.toMatchObject({
      data: [{ instanceId: 'instance-1', status: 'active' }],
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-1',
    });
  });

  it('rejects invalid filters before querying the registry service', async () => {
    const handler = createListInstancesHandler(deps as never);
    const response = await handler(
      new Request('https://studio.example.test/api/v1/iam/instances?status=not-a-status'),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withRegistryService).not.toHaveBeenCalled();
    await expect(readBody(response)).resolves.toMatchObject({
      code: 'invalid_request',
      message: 'Ungültige Filter für die Instanzverwaltung.',
      requestId: 'req-1',
    });
  });

  it('returns not found responses for missing instances', async () => {
    deps.withRegistryService.mockImplementationOnce(async (work) =>
      work({
        getInstanceDetail: vi.fn().mockResolvedValue(null),
      })
    );

    const handler = createGetInstanceHandler(deps as never);
    const response = await handler(
      new Request('https://studio.example.test/api/v1/iam/instances/instance-404'),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(readBody(response)).resolves.toMatchObject({
      code: 'not_found',
      message: 'Instanz wurde nicht gefunden.',
      requestId: 'req-1',
    });
  });

  it('returns the instance detail for valid instance ids', async () => {
    deps.withRegistryService.mockImplementationOnce(async (work) =>
      work({
        getInstanceDetail: vi.fn().mockResolvedValue({ instanceId: 'instance-1', status: 'active' }),
      })
    );

    const handler = createGetInstanceHandler(deps as never);
    const response = await handler(
      new Request('https://studio.example.test/api/v1/iam/instances/instance-1'),
      ctx
    );

    expect(response.status).toBe(200);
    await expect(readBody(response)).resolves.toMatchObject({
      data: { instanceId: 'instance-1', status: 'active' },
      requestId: 'req-1',
    });
  });
});
