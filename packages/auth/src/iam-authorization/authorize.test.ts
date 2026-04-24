import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks — werden VOR den Imports gesetzt (Vitest Hoisting)
// ============================================================================

const mockUser = vi.hoisted(() => ({
  id: 'keycloak-sub-1',
  name: 'Test User',
  roles: [],
  instanceId: undefined as string | undefined,
}));

vi.mock('../middleware.server.js', () => ({
  withAuthenticatedUser: vi.fn(async (_req: Request, fn: (ctx: unknown) => Promise<Response>) =>
    fn({ sessionId: 'sess-1', user: mockUser })
  ),
}));

vi.mock('../iam-governance.server.js', () => ({
  resolveImpersonationSubject: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ workspaceId: 'inst-1', requestId: 'req-x', traceId: 'trace-x' }),
  withRequestContext: (_opts: unknown, fn: () => Promise<Response>) => fn(),
}));

vi.mock('@sva/iam-core', () => ({
  evaluateAuthorizeDecision: vi.fn(() => ({
    allowed: true,
    reason: 'permission_match',
    requestId: undefined,
    traceId: undefined,
  })),
}));

// Hoisted mock-State für permission-store
const resolvePermsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, permissions: [], cacheStatus: 'miss' })
);

vi.mock('./permission-store', () => ({
  resolveEffectivePermissions: resolvePermsMock,
}));

// Hoisted mock-State für shared (loadAuthorizeRequest und errorResponse)
const loadAuthReqMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    instanceId: 'inst-1',
    action: 'content.read',
    resource: { type: 'content', id: 'article-1' },
    context: undefined,
  })
);

const errorRespMock = vi.hoisted(() =>
  vi.fn((status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);

const jsonRespMock = vi.hoisted(() =>
  vi.fn((status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);

vi.mock('./shared', () => ({
  loadAuthorizeRequest: loadAuthReqMock,
  errorResponse: errorRespMock,
  jsonResponse: jsonRespMock,
  iamAuthorizeLatencyHistogram: { record: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  buildRequestContext: vi.fn(() => ({})),
}));

vi.mock('../shared/input-readers.js', () => ({
  readString: vi.fn((value: unknown) => (typeof value === 'string' ? value : undefined)),
  isUuid: vi.fn(
    (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ),
}));

import { authorizeHandler } from './authorize';

// ============================================================================
// Tests — Coverage-Lücken in authorize.ts schließen
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.instanceId = undefined;
  loadAuthReqMock.mockResolvedValue({
    instanceId: 'inst-1',
    action: 'content.read',
    resource: { type: 'content', id: 'article-1' },
    context: undefined,
  });
  resolvePermsMock.mockResolvedValue({ ok: true, permissions: [], cacheStatus: 'miss' });
});

describe('authorizeHandler — invalid_instance_id Branch (L51)', () => {
  it('gibt 400 invalid_instance_id zurück wenn instanceId leer ist', async () => {
    // Simuliert Post-Schema-Parsing mit leerem instanceId
    // (wird durch Zod-Schema normalerweise verhindert, aber die Guard-Zeile muss getestet sein)
    loadAuthReqMock.mockResolvedValueOnce({
      instanceId: '',
      action: 'content.read',
      resource: { type: 'content', id: 'art-1' },
      context: undefined,
    });

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe('invalid_instance_id');
  });
});

describe('authorizeHandler — technische Cache-Fehler', () => {
  it('gibt 503 database_unavailable zurück', async () => {
    resolvePermsMock.mockResolvedValueOnce({ ok: false, error: 'database_unavailable' });

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await authorizeHandler(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe('database_unavailable');
  });
});

describe('authorizeHandler — context.organizationId Branch (L79)', () => {
  it('verwendet context.organizationId wenn vorhanden (deckt ?? false-Branch ab)', async () => {
    loadAuthReqMock.mockResolvedValueOnce({
      instanceId: 'inst-1',
      action: 'content.read',
      resource: { type: 'content', id: 'art-1', organizationId: 'org-resource' },
      context: { organizationId: 'org-from-context' },
    });

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await authorizeHandler(request);
    expect(response.status).toBe(200);

    // Prüfen dass resolveEffectivePermissions mit context-OrganizationId aufgerufen wurde
    expect(resolvePermsMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-from-context' })
    );
  });
});

describe('authorizeHandler — geo context validation', () => {
  it('gibt 400 invalid_request zurück wenn geoUnitId keine UUID ist', async () => {
    loadAuthReqMock.mockResolvedValueOnce({
      instanceId: 'inst-1',
      action: 'content.read',
      resource: {
        type: 'content',
        id: 'art-1',
        attributes: {
          geoUnitId: 'geo-1',
        },
      },
      context: undefined,
    });

    const response = await authorizeHandler(
      new Request('http://localhost/iam/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(resolvePermsMock).not.toHaveBeenCalled();
  });

  it('gibt 400 invalid_request zurück wenn geoHierarchy zu viele Einträge enthält', async () => {
    loadAuthReqMock.mockResolvedValueOnce({
      instanceId: 'inst-1',
      action: 'content.read',
      resource: {
        type: 'content',
        id: 'art-1',
        attributes: {
          geoHierarchy: Array.from({ length: 33 }, (_, index) =>
            `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`
          ),
        },
      },
      context: undefined,
    });

    const response = await authorizeHandler(
      new Request('http://localhost/iam/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(resolvePermsMock).not.toHaveBeenCalled();
  });

  it('gibt 400 invalid_request zurück wenn geoHierarchy vorhanden aber kein Array ist', async () => {
    loadAuthReqMock.mockResolvedValueOnce({
      instanceId: 'inst-1',
      action: 'content.read',
      resource: {
        type: 'content',
        id: 'art-1',
        attributes: {
          geoHierarchy: '00000000-0000-0000-0000-000000000000',
        },
      },
      context: undefined,
    });

    const response = await authorizeHandler(
      new Request('http://localhost/iam/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(resolvePermsMock).not.toHaveBeenCalled();
  });
});
