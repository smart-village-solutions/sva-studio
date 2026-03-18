import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mutable state (vi.hoisted läuft vor allen Imports)
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  user: {
    id: 'kc-admin-1',
    name: 'Admin',
    roles: ['system_admin'] as string[],
    instanceId: 'inst-g',
  },
  requireRolesResult: null as Response | null,
  csrfError: null as Response | null,
  actorResolution: {
    actor: {
      instanceId: 'inst-g',
      actorAccountId: 'acc-actor',
      requestId: 'req-1',
      traceId: 'trace-1',
    },
  } as { actor: { instanceId: string; actorAccountId: string; requestId: string; traceId: string } } | { error: Response },
  dbQueryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
  dbError: null as unknown,
  parseBodyResult: { ok: true, data: {} } as { ok: boolean; data: Record<string, unknown> },
  pathSegments: {} as Record<number, string | null>,
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-1', traceId: 'trace-1', workspaceId: 'inst-g' }),
  withRequestContext: async (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('../iam-account-management/shared', () => ({
  requireRoles: vi.fn(() => state.requireRolesResult),
  withInstanceScopedDb: vi.fn((_id: string, fn: (c: unknown) => unknown) => {
    if (state.dbError) throw state.dbError;
    const client = {
      query: vi.fn((text: string, values?: readonly unknown[]) => {
        if (state.dbQueryHandler) {
          return Promise.resolve(state.dbQueryHandler(text, values ?? []));
        }
        return Promise.resolve({ rowCount: 1, rows: [{ id: 'acc-member-1' }] });
      }),
    };
    return fn(client);
  }),
  emitActivityLog: vi.fn().mockResolvedValue(undefined),
  resolveActorInfo: vi.fn(() => Promise.resolve(state.actorResolution)),
}));

vi.mock('../iam-account-management/csrf', () => ({
  validateCsrf: vi.fn(() => state.csrfError),
}));

vi.mock('../iam-account-management/api-helpers', () => ({
  requireRoles: vi.fn(() => null),
  readPathSegment: vi.fn((_req: Request, index: number) => state.pathSegments[index] ?? null),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  parseRequestBody: vi.fn(() => Promise.resolve(state.parseBodyResult)),
  asApiItem: vi.fn((data: unknown) => data),
  asApiList: vi.fn((data: unknown, _meta: unknown) => ({ items: data, meta: _meta })),
  createApiError: vi.fn(
    (status: number, code: string, message?: string, _reqId?: string) =>
      new Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
  toPayloadHash: vi.fn(),
}));

vi.mock('../iam-account-management/constants', () => ({
  ADMIN_ROLES: ['system_admin', 'instance_admin'],
}));

vi.mock('./events', () => ({
  publishGroupEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/db-helpers', () => ({
  jsonResponse: vi.fn(
    (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  ),
  isUuid: vi.fn(() => true),
}));

vi.mock('../shared/input-readers', () => ({
  isUuid: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// Imports (nach Mocks)
// ---------------------------------------------------------------------------
import {
  assignGroupMembershipInternal,
  assignGroupRoleInternal,
  createGroupInternal,
  getGroupInternal,
  listGroupsInternal,
  removeGroupMembershipInternal,
  removeGroupRoleInternal,
  updateGroupInternal,
} from './handlers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const makeCtx = () => ({ sessionId: 'sess-1', user: state.user });

const makeRequest = (url = 'https://api.example.com/api/v1/iam/inst-g/groups', opts?: RequestInit) =>
  new Request(url, opts);

const makeGroupRequest = (groupId = VALID_UUID, subPath = '') =>
  new Request(`https://api.example.com/api/v1/iam/inst-g/groups/${groupId}${subPath}`);

beforeEach(() => {
  vi.clearAllMocks();
  state.requireRolesResult = null;
  state.csrfError = null;
  state.actorResolution = {
    actor: {
      instanceId: 'inst-g',
      actorAccountId: 'acc-actor',
      requestId: 'req-1',
      traceId: 'trace-1',
    },
  };
  state.dbQueryHandler = null;
  state.dbError = null;
  state.parseBodyResult = {
    ok: true,
    data: {
      groupKey: 'test-group',
      displayName: 'Test Group',
      groupType: 'custom',
      isActive: true,
      roleId: VALID_UUID,
      keycloakSubject: 'user-123',
    },
  };
  state.pathSegments = {
    4: VALID_UUID,
    6: VALID_UUID,
  };
});

// ============================================================================
// listGroupsInternal
// ============================================================================
describe('listGroupsInternal', () => {
  it('gibt 200 mit Gruppen-Liste zurück', async () => {
    state.dbQueryHandler = () => ({
      rowCount: 2,
      rows: [
        {
          id: 'grp-1',
          instance_id: 'inst-g',
          group_key: 'admins',
          display_name: 'Admins',
          description: null,
          group_type: 'custom',
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          member_count: 5,
          role_count: 2,
        },
      ],
    });

    const response = await listGroupsInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 403 zurück wenn requireRoles fehlschlägt', async () => {
    state.requireRolesResult = new Response('Forbidden', { status: 403 });
    const response = await listGroupsInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(403);
  });

  it('gibt actorResolution-Fehler zurück', async () => {
    state.actorResolution = {
      error: new Response('Unauthorized', { status: 401 }),
    };
    const response = await listGroupsInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(401);
  });

  it('gibt 503 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('DB timeout');
    const response = await listGroupsInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// getGroupInternal
// ============================================================================
describe('getGroupInternal', () => {
  it('gibt 200 mit Gruppendetails zurück', async () => {
    let callCount = 0;
    state.dbQueryHandler = () => {
      callCount++;
      if (callCount === 1) {
        return {
          rowCount: 1,
          rows: [
            {
              id: VALID_UUID,
              instance_id: 'inst-g',
              group_key: 'admins',
              display_name: 'Admins',
              description: null,
              group_type: 'custom',
              is_active: true,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
              member_count: 1,
              role_count: 1,
            },
          ],
        };
      }
      return { rowCount: 1, rows: [{ role_id: 'role-1' }] };
    };

    const response = await getGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 404 zurück wenn Gruppe nicht gefunden', async () => {
    state.dbQueryHandler = () => ({ rowCount: 0, rows: [] });
    const response = await getGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(404);
  });

  it('gibt 400 zurück wenn groupId fehlt', async () => {
    state.pathSegments[4] = null;
    const response = await getGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(400);
  });

  it('gibt 400 zurück wenn groupId keine UUID', async () => {
    const { isUuid } = await import('../shared/input-readers');
    (isUuid as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const response = await getGroupInternal(makeGroupRequest('not-a-uuid'), makeCtx());
    expect(response.status).toBe(400);
  });
});

// ============================================================================
// createGroupInternal
// ============================================================================
describe('createGroupInternal', () => {
  it('gibt 201 bei erfolgreicher Erstellung zurück', async () => {
    const response = await createGroupInternal(
      makeRequest('https://api.example.com/api/v1/iam/inst-g/groups', { method: 'POST' }),
      makeCtx()
    );
    expect(response.status).toBe(201);
  });

  it('gibt 403 zurück wenn CSRF-Check fehlschlägt', async () => {
    state.csrfError = new Response('CSRF failed', { status: 403 });
    const response = await createGroupInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(403);
  });

  it('gibt 400 zurück bei ungültigem Body', async () => {
    state.parseBodyResult = { ok: false, data: {} };
    const response = await createGroupInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(400);
  });

  it('gibt 409 zurück bei Duplikat-Key', async () => {
    state.dbError = new Error('groups_instance_key_uniq');
    const response = await createGroupInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(409);
  });

  it('gibt 503 bei allgemeinem DB-Fehler zurück', async () => {
    state.dbError = new Error('Connection refused');
    const response = await createGroupInternal(makeRequest(), makeCtx());
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// updateGroupInternal
// ============================================================================
describe('updateGroupInternal', () => {
  beforeEach(() => {
    state.parseBodyResult = { ok: true, data: { displayName: 'Neuer Name' } };
  });

  it('gibt 200 bei erfolgreichem Update zurück', async () => {
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: VALID_UUID }] });
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 404 zurück wenn Gruppe nicht gefunden', async () => {
    state.dbQueryHandler = () => ({ rowCount: 0, rows: [] });
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(404);
  });

  it('gibt 400 zurück wenn keine Änderungen angegeben (leerer Body)', async () => {
    state.parseBodyResult = { ok: true, data: {} };
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(400);
  });

  it('gibt 503 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('Timeout');
    state.parseBodyResult = { ok: true, data: { displayName: 'Test' } };
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(503);
  });

  it('akzeptiert isActive-Update', async () => {
    state.parseBodyResult = { ok: true, data: { isActive: false } };
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: VALID_UUID }] });
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('akzeptiert description mit null (nullable)', async () => {
    state.parseBodyResult = { ok: true, data: { description: null } };
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: VALID_UUID }] });
    const response = await updateGroupInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });
});

// ============================================================================
// assignGroupRoleInternal
// ============================================================================
describe('assignGroupRoleInternal', () => {
  beforeEach(() => {
    state.parseBodyResult = { ok: true, data: { roleId: VALID_UUID } };
  });

  it('gibt 200 zurück bei erfolgreicher Rollenzuweisung', async () => {
    const response = await assignGroupRoleInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 503 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('DB error');
    const response = await assignGroupRoleInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(503);
  });

  it('gibt 400 zurück wenn groupId fehlt', async () => {
    state.pathSegments[4] = null;
    const response = await assignGroupRoleInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(400);
  });
});

// ============================================================================
// removeGroupRoleInternal
// ============================================================================
describe('removeGroupRoleInternal', () => {
  it('gibt 200 zurück bei erfolgreicher Rollenentfernung', async () => {
    const response = await removeGroupRoleInternal(
      makeRequest(`https://api.example.com/api/v1/iam/inst-g/groups/${VALID_UUID}/roles/${VALID_UUID}`),
      makeCtx()
    );
    expect(response.status).toBe(200);
  });

  it('gibt 400 zurück wenn roleId fehlt', async () => {
    state.pathSegments[6] = null;
    const response = await removeGroupRoleInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(400);
  });

  it('gibt 503 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('DB error');
    const response = await removeGroupRoleInternal(
      makeRequest(`https://api.example.com/api/v1/iam/inst-g/groups/${VALID_UUID}/roles/${VALID_UUID}`),
      makeCtx()
    );
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// assignGroupMembershipInternal
// ============================================================================
describe('assignGroupMembershipInternal', () => {
  beforeEach(() => {
    state.parseBodyResult = {
      ok: true,
      data: { keycloakSubject: 'user-123', validFrom: null, validUntil: null },
    };
    // Erster Query-Call gibt accountId zurück
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: 'acc-member-1' }] });
  });

  it('gibt 200 zurück bei erfolgreicher Mitgliedschaftszuweisung', async () => {
    const response = await assignGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 404 zurück wenn Benutzer nicht gefunden (account_not_found)', async () => {
    // Erster Call gibt leere Rows zurück → account_not_found wird geworfen
    state.dbQueryHandler = () => ({ rowCount: 0, rows: [] });
    const response = await assignGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(404);
  });

  it('gibt 503 zurück bei allgemeinem DB-Fehler', async () => {
    state.dbError = new Error('Connection error');
    const response = await assignGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// removeGroupMembershipInternal
// ============================================================================
describe('removeGroupMembershipInternal', () => {
  beforeEach(() => {
    state.parseBodyResult = { ok: true, data: { keycloakSubject: 'user-123' } };
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: 'acc-member-1' }] });
  });

  it('gibt 200 zurück bei erfolgreicher Mitgliedschaftsentfernung', async () => {
    const response = await removeGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 200 zurück wenn Benutzer nicht Mitglied (graceful)', async () => {
    // account not found → early return, kein Fehler
    state.dbQueryHandler = () => ({ rowCount: 0, rows: [] });
    const response = await removeGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(200);
  });

  it('gibt 503 zurück bei DB-Fehler', async () => {
    state.dbError = new Error('DB error');
    const response = await removeGroupMembershipInternal(makeGroupRequest(), makeCtx());
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// Cross-Handler: gemeinsame Rejection-Paths (CSRF, actorResolution, requireRoles)
// ============================================================================
describe('Mutation-Handler — Gemeinsame Rejection-Paths', () => {
  beforeEach(() => {
    state.parseBodyResult = {
      ok: true,
      data: {
        displayName: 'Updated',
        roleId: VALID_UUID,
        keycloakSubject: 'user-123',
        groupKey: 'test-key',
        groupType: 'custom',
        isActive: true,
      },
    };
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: 'acc-member-1' }] });
  });

  it('createGroupInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await createGroupInternal(makeRequest(), makeCtx())).status).toBe(403);
  });

  it('updateGroupInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await updateGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(403);
  });

  it('assignGroupRoleInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await assignGroupRoleInternal(makeGroupRequest(), makeCtx())).status).toBe(403);
  });

  it('removeGroupRoleInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await removeGroupRoleInternal(makeRequest(`https://api.example.com/api/v1/iam/inst-g/groups/${VALID_UUID}/roles/${VALID_UUID}`), makeCtx())).status).toBe(403);
  });

  it('assignGroupMembershipInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(403);
  });

  it('removeGroupMembershipInternal: 403 bei CSRF-Fehler', async () => {
    state.csrfError = new Response('CSRF', { status: 403 });
    expect((await removeGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(403);
  });

  it('getGroupInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await getGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(401);
  });

  it('updateGroupInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await updateGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(401);
  });

  it('assignGroupRoleInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await assignGroupRoleInternal(makeGroupRequest(), makeCtx())).status).toBe(401);
  });

  it('removeGroupRoleInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await removeGroupRoleInternal(makeRequest(`https://api.example.com/api/v1/iam/inst-g/groups/${VALID_UUID}/roles/${VALID_UUID}`), makeCtx())).status).toBe(401);
  });

  it('assignGroupMembershipInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(401);
  });

  it('removeGroupMembershipInternal: 401 bei actorResolution.error', async () => {
    state.actorResolution = { error: new Response('Unauth', { status: 401 }) };
    expect((await removeGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(401);
  });
});

// ============================================================================
// updateGroupInternal — Branches fuer description und ungueltigen Body
// ============================================================================
describe('updateGroupInternal — weitere Branch-Pfade', () => {
  it('description als expliziter Wert wird beruecksichtigt', async () => {
    state.parseBodyResult = { ok: true, data: { description: 'Neue Beschreibung' } };
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: VALID_UUID }] });
    expect((await updateGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(200);
  });

  it('gibt 400 zurueck wenn Body-Parsing fehlschlaegt', async () => {
    state.parseBodyResult = { ok: false, data: {} };
    expect((await updateGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(400);
  });

  it('gibt 400 zurueck wenn groupId keine UUID ist', async () => {
    const { isUuid: isUuidMock } = await import('../shared/input-readers');
    (isUuidMock as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    state.parseBodyResult = { ok: true, data: { displayName: 'Test' } };
    expect((await updateGroupInternal(makeGroupRequest('not-a-uuid'), makeCtx())).status).toBe(400);
  });
});

// ============================================================================
// assignGroupRoleInternal — Body-Validierung
// ============================================================================
describe('assignGroupRoleInternal — Body-Validierung', () => {
  it('gibt 400 zurueck bei ungueltigem Body', async () => {
    state.parseBodyResult = { ok: false, data: {} };
    expect((await assignGroupRoleInternal(makeGroupRequest(), makeCtx())).status).toBe(400);
  });
});

// ============================================================================
// removeGroupRoleInternal — UUID-Validierung
// ============================================================================
describe('removeGroupRoleInternal — UUID-Validierung', () => {
  it('gibt 400 zurueck wenn roleId keine UUID ist', async () => {
    const { isUuid: isUuidMock } = await import('../shared/input-readers');
    (isUuidMock as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(true)   // groupId OK
      .mockReturnValueOnce(false); // roleId ungueltig
    expect((await removeGroupRoleInternal(makeGroupRequest(), makeCtx())).status).toBe(400);
  });
});

// ============================================================================
// assignGroupMembershipInternal — Body-Validierung
// ============================================================================
describe('assignGroupMembershipInternal — Body-Validierung', () => {
  it('gibt 400 zurueck bei ungueltigem Body', async () => {
    state.parseBodyResult = { ok: false, data: {} };
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(400);
  });

  it('gibt 400 zurueck wenn groupId fehlt', async () => {
    state.pathSegments[4] = null;
    state.parseBodyResult = { ok: true, data: { keycloakSubject: 'user-xx' } };
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(400);
  });
});

// ============================================================================
// removeGroupMembershipInternal — Body-Validierung
// ============================================================================
describe('removeGroupMembershipInternal — Body-Validierung', () => {
  it('gibt 400 zurueck bei ungueltigem Body', async () => {
    state.parseBodyResult = { ok: false, data: {} };
    expect((await removeGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(400);

  });
});

// ============================================================================
// Alle Handler — Non-Error-Throw (String) deckt String(error) Branch ab
// ============================================================================
describe('Alle Handler — Non-Error-Throw im catch', () => {
  beforeEach(() => {
    state.parseBodyResult = {
      ok: true,
      data: {
        groupKey: 'test-key',
        displayName: 'Test',
        groupType: 'custom',
        isActive: true,
        roleId: VALID_UUID,
        keycloakSubject: 'user-123',
      },
    };
    // Wirf einen Plain-String statt Error-Instanz (deckt String(error) Branch ab)
    state.dbError = 'string-database-error';
  });

  it('listGroupsInternal: 503 bei non-Error throw', async () => {
    expect((await listGroupsInternal(makeRequest(), makeCtx())).status).toBe(503);
  });

  it('getGroupInternal: 503 bei non-Error throw', async () => {
    expect((await getGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(503);
  });

  it('createGroupInternal: 503 bei non-Error throw', async () => {
    expect((await createGroupInternal(makeRequest(), makeCtx())).status).toBe(503);
  });

  it('updateGroupInternal: 503 bei non-Error throw', async () => {
    expect((await updateGroupInternal(makeGroupRequest(), makeCtx())).status).toBe(503);
  });

  it('assignGroupRoleInternal: 503 bei non-Error throw', async () => {
    expect((await assignGroupRoleInternal(makeGroupRequest(), makeCtx())).status).toBe(503);
  });

  it('removeGroupRoleInternal: 503 bei non-Error throw', async () => {
    expect((await removeGroupRoleInternal(makeRequest(`https://api.example.com/api/v1/iam/inst-g/groups/${VALID_UUID}/roles/${VALID_UUID}`), makeCtx())).status).toBe(503);
  });

  it('assignGroupMembershipInternal: 503 bei non-Error throw', async () => {
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(503);
  });

  it('removeGroupMembershipInternal: 503 bei non-Error throw', async () => {
    expect((await removeGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(503);
  });
});

// ============================================================================
// assignGroupMembershipInternal — validFrom/validUntil als definierte Werte
// ============================================================================
describe('assignGroupMembershipInternal — validFrom/validUntil definiert', () => {
  beforeEach(() => {
    state.dbQueryHandler = () => ({ rowCount: 1, rows: [{ id: 'acc-m1' }] });
  });

  it('akzeptiert validFrom und validUntil als ISO-Datum-Strings', async () => {
    state.parseBodyResult = {
      ok: true,
      data: {
        keycloakSubject: 'user-123',
        validFrom: '2025-01-01T00:00:00Z',
        validUntil: '2026-01-01T00:00:00Z',
      },
    };
    expect((await assignGroupMembershipInternal(makeGroupRequest(), makeCtx())).status).toBe(200);
  });
});
