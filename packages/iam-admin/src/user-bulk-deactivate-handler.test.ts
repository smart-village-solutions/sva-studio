import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBulkDeactivateHandlerInternal,
  type BulkDeactivateHandlerDeps,
} from './user-bulk-deactivate-handler.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'actor-account-1',
  requestId: 'req-bulk',
  traceId: 'trace-bulk',
};

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (overrides: Partial<BulkDeactivateHandlerDeps> = {}): BulkDeactivateHandlerDeps => {
  const identityProvider = {
    provider: {
      deactivateUser: vi.fn(async () => undefined),
    },
  };

  return {
    completeBulkDeactivateFailure: vi.fn(async ({ error }) =>
      createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
    ),
    completeBulkDeactivateSuccess: vi.fn(async ({ details }) =>
      createJsonResponse(200, { data: { deactivatedUserIds: details.map((detail) => detail.id) } })
    ),
    emitActivityLog: vi.fn(async () => undefined),
    ensureActorCanManageTarget: vi.fn(() => ({ ok: true })),
    iamUserOperationsCounter: {
      add: vi.fn(),
    },
    logger: {
      error: vi.fn(),
    },
    notifyPermissionInvalidation: vi.fn(async () => undefined),
    resolveActorMaxRoleLevel: vi.fn(async () => 100),
    resolveBulkDeactivateContext: vi.fn(async () => ({
      actor,
      identityProvider,
      payload: {
        userIds: [
          '11111111-1111-1111-8111-111111111111',
          '11111111-1111-1111-8111-111111111111',
          '22222222-2222-2222-8222-222222222222',
        ],
      },
      idempotencyKey: 'idem-1',
    })),
    resolveSystemAdminCount: vi.fn(async () => 2),
    resolveUsersForBulkDeactivation: vi.fn(async () => [
      {
        id: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'kc-user-1',
        status: 'active',
        roles: [{ roleId: 'role-editor', roleKey: 'editor', roleName: 'Editor', roleLevel: 10 }],
      },
      {
        id: '22222222-2222-2222-8222-222222222222',
        keycloakSubject: 'kc-user-2',
        status: 'inactive',
        roles: [],
      },
    ]),
    trackKeycloakCall: vi.fn(async (_operation, work) => work()),
    withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      })
    ),
    ...overrides,
  };
};

describe('createBulkDeactivateHandlerInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates requested user ids, deactivates users locally and in Keycloak, then completes idempotency', async () => {
    const deps = createDeps();
    const handler = createBulkDeactivateHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/bulk-deactivate'), ctx);

    expect(response.status).toBe(200);
    expect(deps.resolveUsersForBulkDeactivation).toHaveBeenCalledWith(
      expect.anything(),
      {
        instanceId: 'de-musterhausen',
        userIds: [
          '11111111-1111-1111-8111-111111111111',
          '22222222-2222-2222-8222-222222222222',
        ],
      }
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'user.bulk_deactivated',
        payload: { total: 2 },
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledTimes(2);
    expect(deps.trackKeycloakCall).toHaveBeenCalledTimes(2);
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'bulk_deactivate',
      result: 'success',
    });
    expect(deps.completeBulkDeactivateSuccess).toHaveBeenCalledWith({
      actor,
      idempotencyKey: 'idem-1',
      details: expect.arrayContaining([
        expect.objectContaining({ id: '11111111-1111-1111-8111-111111111111' }),
        expect.objectContaining({ id: '22222222-2222-2222-8222-222222222222' }),
      ]),
    });
  });

  it('returns precondition responses without running mutation work', async () => {
    const preconditionResponse = createJsonResponse(409, { error: { code: 'idempotency_key_reuse' } });
    const deps = createDeps({
      resolveBulkDeactivateContext: vi.fn(async () => preconditionResponse),
    });
    const handler = createBulkDeactivateHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/bulk-deactivate'), ctx);

    expect(response).toBe(preconditionResponse);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
    expect(deps.completeBulkDeactivateFailure).not.toHaveBeenCalled();
  });

  it('fails through the mutation error path when the actor targets itself', async () => {
    const deps = createDeps({
      resolveUsersForBulkDeactivation: vi.fn(async () => [
        {
          id: '11111111-1111-1111-8111-111111111111',
          keycloakSubject: 'kc-actor-1',
          status: 'active',
          roles: [],
        },
      ]),
    });
    const handler = createBulkDeactivateHandlerInternal(deps);

    const response = await handler(new Request('http://localhost/api/v1/iam/users/bulk-deactivate'), ctx);

    expect(response.status).toBe(500);
    expect(deps.completeBulkDeactivateFailure).toHaveBeenCalledWith({
      actor,
      idempotencyKey: 'idem-1',
      error: expect.objectContaining({
        message: 'self_protection:Eigener Nutzer kann nicht deaktiviert werden.',
      }),
    });
    expect(deps.iamUserOperationsCounter.add).toHaveBeenCalledWith(1, {
      action: 'bulk_deactivate',
      result: 'failure',
    });
  });

  it('protects the last active system admin from bulk deactivation', async () => {
    const deps = createDeps({
      resolveSystemAdminCount: vi.fn(async () => 1),
      resolveUsersForBulkDeactivation: vi.fn(async () => [
        {
          id: '11111111-1111-1111-8111-111111111111',
          keycloakSubject: 'kc-admin-1',
          status: 'active',
          roles: [{ roleId: 'role-admin', roleKey: 'system_admin', roleName: 'System Admin', roleLevel: 100 }],
        },
      ]),
    });
    const handler = createBulkDeactivateHandlerInternal(deps);

    await handler(new Request('http://localhost/api/v1/iam/users/bulk-deactivate'), ctx);

    expect(deps.completeBulkDeactivateFailure).toHaveBeenCalledWith({
      actor,
      idempotencyKey: 'idem-1',
      error: expect.objectContaining({
        message: 'last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.',
      }),
    });
  });

  it('rejects targets above the actor management level', async () => {
    const deps = createDeps({
      ensureActorCanManageTarget: vi.fn(() => ({
        ok: false,
        code: 'forbidden',
        message: 'Zielnutzer darf nicht verwaltet werden.',
      })),
    });
    const handler = createBulkDeactivateHandlerInternal(deps);

    await handler(new Request('http://localhost/api/v1/iam/users/bulk-deactivate'), ctx);

    expect(deps.completeBulkDeactivateFailure).toHaveBeenCalledWith({
      actor,
      idempotencyKey: 'idem-1',
      error: expect.objectContaining({
        message: 'forbidden:Zielnutzer darf nicht verwaltet werden.',
      }),
    });
  });
});
