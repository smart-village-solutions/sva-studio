import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
  withRequestContext: (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('./db', () => ({
  jsonResponse: vi.fn((status: number, payload: unknown, headers?: Record<string, string>) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
  }),
  withInstanceDb: vi.fn(),
  requireRoles: vi.fn(() => null),
  emitActivityLog: vi.fn(),
  resolveActorInfo: vi.fn(),
}));

import { withInstanceDb } from './db';
import { withLegalTextCompliance } from './legal-text-enforcement';

const mockWithDb = withInstanceDb as ReturnType<typeof vi.fn>;

const makeHandler = () => vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withLegalTextCompliance', () => {
  it('ruft handler auf wenn keine offenen Akzeptanzen', async () => {
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [{ pending_count: 0 }] }) })
    );

    const handler = makeHandler();
    const response = await withLegalTextCompliance('inst-1', 'user-sub', handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('cached erfolgreiche Prüfungen ohne offene Akzeptanzen kurzzeitig pro Instanz und Benutzer', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ pending_count: 0 }] });
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn({ query }));

    const firstHandler = makeHandler();
    const secondHandler = makeHandler();

    await withLegalTextCompliance('inst-cache', 'user-sub', firstHandler);
    await withLegalTextCompliance('inst-cache', 'user-sub', secondHandler);

    expect(firstHandler).toHaveBeenCalledOnce();
    expect(secondHandler).toHaveBeenCalledOnce();
    expect(mockWithDb).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('gibt 403 zurück wenn pendingCount > 0', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ pending_count: 2 }] });
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn({ query }));

    const handler = makeHandler();
    const response = await withLegalTextCompliance('inst-2', 'user-sub', handler, {
      returnTo: '/admin/users?tab=permissions',
    });

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toEqual({
      error: expect.objectContaining({
        code: 'legal_acceptance_required',
        message: 'Vor der weiteren Nutzung müssen ausstehende Rechtstexte akzeptiert werden.',
        classification: 'unknown',
        recommendedAction: 'erneut_versuchen',
        safeDetails: {
          return_to: '/admin/users?tab=permissions',
        },
        status: 'degradiert',
        details: {
          pending_count: 2,
          return_to: '/admin/users?tab=permissions',
        },
      }),
      requestId: 'req-x',
    });

    await withLegalTextCompliance('inst-2', 'user-sub', makeHandler());
    expect(mockWithDb).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('enthält Content-Type application/json im 403', async () => {
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [{ pending_count: 1 }] }) })
    );

    const response = await withLegalTextCompliance('inst-3', 'user-x', makeHandler());
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('gibt 503 zurück bei DB-Fehler und ruft handler nicht auf', async () => {
    mockWithDb
      .mockRejectedValueOnce(new Error('DB down'))
      .mockRejectedValueOnce(new Error('DB still down'));

    const handler = makeHandler();
    const response = await withLegalTextCompliance('inst-4', 'user-sub', handler);

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        code: 'database_unavailable',
        message: 'Rechtstext-Prüfung ist vorübergehend nicht verfügbar.',
        classification: 'database_or_schema_drift',
        recommendedAction: 'migration_pruefen',
        status: 'degradiert',
      }),
      requestId: 'req-x',
    });

    await withLegalTextCompliance('inst-4', 'user-sub', makeHandler());
    expect(mockWithDb).toHaveBeenCalledTimes(2);
  });

  it('gibt handler-Response weiter wenn kein Fehler', async () => {
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [{ pending_count: 0 }] }) })
    );

    const handler = vi.fn().mockResolvedValue(new Response('Custom body', { status: 201 }));
    const response = await withLegalTextCompliance('inst-5', 'user-sub', handler);

    expect(response.status).toBe(201);
  });

  it('behandelt fehlende DB-Row (null pending_count) als keine offenen Texte', async () => {
    // Row zurückgeben mit keinen Rows → pending_count = 0 via nullish coalescing
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [] }) })
    );

    const handler = makeHandler();
    await withLegalTextCompliance('inst-6', 'user-sub', handler);

    // pending_count ist undefined/null → 0 → kein Block
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// withLegalTextCompliance — Non-Error-Throw (String(error) Branch)
// ============================================================================
describe('withLegalTextCompliance — Non-Error-Throw', () => {
  it('gibt 503 zurück wenn DB einen Non-Error-Wert (String) wirft', async () => {
    const nonErrorReason: unknown = 'plain-string-db-error';
    // NOSONAR: absichtlich kein Error-Objekt, um den String(error)-Pfad zu testen.
    mockWithDb.mockImplementation(() => Promise.reject(nonErrorReason));

    const handler = makeHandler();
    const response = await withLegalTextCompliance('inst-99', 'user-non-error', handler);

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        code: 'database_unavailable',
        message: 'Rechtstext-Prüfung ist vorübergehend nicht verfügbar.',
        classification: 'database_or_schema_drift',
        recommendedAction: 'migration_pruefen',
        status: 'degradiert',
      }),
      requestId: 'req-x',
    });
  });
});
