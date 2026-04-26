import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable state für flexible Mock-Konfiguration
const state = vi.hoisted(() => ({
  user: {
    id: 'kc-admin-1',
    name: 'Admin',
    roles: ['system_admin'] as string[],
    instanceId: 'inst-export',
  },
  requireRolesResult: null as Response | null,
  instanceId: 'inst-export' as string | null,
  dbRows: [] as unknown[],
  dbError: null as Error | null,
}));

vi.mock('../middleware.server', () => ({
  withAuthenticatedUser: vi.fn(
    async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
      handler({ sessionId: 'test-session', user: state.user })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
  withRequestContext: async (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('../iam-account-management/shared', () => ({
  requireRoles: vi.fn(() => state.requireRolesResult),
  withInstanceScopedDb: vi.fn((_id: string, fn: (c: unknown) => unknown) => {
    if (state.dbError) throw state.dbError;
    const client = {
      query: vi.fn().mockResolvedValue({ rows: state.dbRows, rowCount: state.dbRows.length }),
    };
    return fn(client);
  }),
  emitActivityLog: vi.fn(),
  resolveActorInfo: vi.fn(),
}));

vi.mock('../iam-account-management/api-helpers', () => ({
  readPathSegment: vi.fn((_req: Request, _index: number) => state.instanceId),
  requireRoles: vi.fn(() => null),
  asApiItem: vi.fn((data: unknown, _reqId: string) => data),
  asApiList: vi.fn((data: unknown) => data),
  createApiError: vi.fn(
    (status: number, code: string) =>
      new Response(JSON.stringify({ error: { code } }), { status, headers: { 'Content-Type': 'application/json' } })
  ),
  parseRequestBody: vi.fn(),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  toPayloadHash: vi.fn(),
}));

vi.mock('../iam-account-management/constants', () => ({
  ADMIN_ROLES: ['system_admin', 'instance_admin'],
}));

import { legalConsentExportHandler } from './legal-consent-export.server';

const makeRequest = (url = 'https://example.com/api/v1/iam/inst-export/legal-consent-export') =>
  new Request(url, { method: 'GET' });

beforeEach(() => {
  vi.clearAllMocks();
  state.requireRolesResult = null;
  state.instanceId = 'inst-export';
  state.dbRows = [];
  state.dbError = null;
  state.user = { id: 'kc-admin-1', name: 'Admin', roles: ['system_admin'], instanceId: 'inst-export' };
});

// ---------------------------------------------------------------------------
// Happy Path
// ---------------------------------------------------------------------------
describe('legalConsentExportHandler', () => {
  it('gibt 200 mit leerer Datenliste zurück', async () => {
    const response = await legalConsentExportHandler(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(0);
    expect(body.data).toEqual([]);
  });

  it('gibt gefundene Records zurück', async () => {
    state.dbRows = [
      {
        id: 'rec-1',
        workspace_id: null,
        subject_id: 'user-sub-1',
        legal_text_id: 'text-123',
        legal_text_version: 'v1.0',
        accepted_at: '2025-01-15T10:00:00Z',
        revoked_at: null,
        action_type: 'accepted',
      },
    ];

    const response = await legalConsentExportHandler(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.data[0].legalTextId).toBe('text-123');
    expect(body.data[0].legalTextVersion).toBe('v1.0');
    expect(body.data[0].acceptedAt).toBe('2025-01-15T10:00:00Z');
  });

  it('mappt record mit revokedAt korrekt', async () => {
    state.dbRows = [
      {
        id: 'rec-2',
        workspace_id: 'ws-abc',
        subject_id: null,
        legal_text_id: 'text-456',
        legal_text_version: 'v2.0',
        accepted_at: '2025-02-01T08:00:00Z',
        revoked_at: '2025-03-01T12:00:00Z',
        action_type: null,
      },
    ];

    const response = await legalConsentExportHandler(makeRequest());
    const body = await response.json();
    expect(body.data[0].revokedAt).toBe('2025-03-01T12:00:00Z');
    expect(body.data[0].workspaceId).toBe('ws-abc');
    expect(body.data[0].actionType).toBe('accepted'); // Fallback wenn null
  });

  it('übergibt accountId-Filter wenn query param gesetzt', async () => {
    const { withInstanceScopedDb } = await import('../iam-account-management/shared');
    const mockFn = withInstanceScopedDb as ReturnType<typeof vi.fn>;

    const url = 'https://example.com/api/v1/iam/inst-export/legal-consent-export?accountId=acc-123';
    await legalConsentExportHandler(makeRequest(url));

    // withInstanceScopedDb wurde aufgerufen
    expect(mockFn).toHaveBeenCalledWith('inst-export', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Role Check Rejection
// ---------------------------------------------------------------------------
describe('legalConsentExportHandler — Zugriffsverweigerung', () => {
  it('gibt 403 zurück wenn Export-Permission fehlt', async () => {
    state.user = { id: 'kc-app-1', name: 'App Manager', roles: ['app_manager'], instanceId: 'inst-export' };

    const response = await legalConsentExportHandler(makeRequest());
    expect(response.status).toBe(403);
  });
});

describe('legalConsentExportHandler — Permission Alias', () => {
  it('erlaubt Export mit expliziter legal-consents:export-Berechtigung', async () => {
    state.user = {
      id: 'kc-export-1',
      name: 'Export Admin',
      roles: ['legal-consents:export'],
      instanceId: 'inst-export',
    };

    const response = await legalConsentExportHandler(makeRequest());
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Validierung
// ---------------------------------------------------------------------------
describe('legalConsentExportHandler — Validierung', () => {
  it('gibt 400 zurück wenn instanceId fehlt (readPathSegment gibt null zurück)', async () => {
    state.instanceId = null;

    const response = await legalConsentExportHandler(makeRequest());
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('invalid_instance_id');
  });
});

// ---------------------------------------------------------------------------
// Fehlerbehandlung
// ---------------------------------------------------------------------------
describe('legalConsentExportHandler — Fehler', () => {
  it('gibt 500 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('DB unavailable');

    const response = await legalConsentExportHandler(makeRequest());
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe('export_failed');
  });
});

describe('legalConsentExportHandler — Rate Limiting', () => {
  it('gibt 429 mit Retry-After zurück ab dem elften Export pro Stunde', async () => {
    let response: Response | null = null;
    state.user = { id: 'kc-rate-1', name: 'Rate Limit', roles: ['system_admin'], instanceId: 'inst-export' };

    for (let index = 0; index < 11; index += 1) {
      response = await legalConsentExportHandler(makeRequest());
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBeTruthy();
    expect(await response?.json()).toEqual({ error: { code: 'rate_limited' } });
  });
});
