import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-reconcile',
      traceId: 'trace-reconcile',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  identityProvider: null as
    | null
    | {
        provider: {
          listRoles: ReturnType<typeof vi.fn>;
          getRoleByName: ReturnType<typeof vi.fn>;
          createRole: ReturnType<typeof vi.fn>;
          updateRole: ReturnType<typeof vi.fn>;
        };
      },
  dbRoles: [] as Array<Record<string, unknown>>,
  insertShouldFail: false,
  setRoleSyncState: vi.fn(),
  emitRoleAuditEvent: vi.fn(),
  setRoleDriftBacklog: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({ requestId: 'req-reconcile' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(
      JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, ...(requestId ? { requestId } : {}) }),
      { status, headers: { 'content-type': 'application/json' } }
    ),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./platform-iam-handlers.js', () => ({
  reconcilePlatformRolesInternal: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  emitRoleAuditEvent: state.emitRoleAuditEvent,
  logger: { error: vi.fn() },
  requireRoles: vi.fn(() => null),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveIdentityProvider: vi.fn(() => state.identityProvider),
  setRoleDriftBacklog: state.setRoleDriftBacklog,
  setRoleSyncState: state.setRoleSyncState,
  trackKeycloakCall: vi.fn(async (_operation: string, fn: () => Promise<unknown>) => fn()),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, fn: (client: unknown) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (text: string, values?: readonly unknown[]) => {
        if (text.includes('FROM iam.roles')) {
          return { rows: state.dbRoles };
        }
        if (text.includes('INSERT INTO iam.roles')) {
          if (state.insertShouldFail) {
            throw new Error('insert failed');
          }
          return { rows: [{ id: '22222222-2222-2222-8222-222222222222' }] };
        }
        if (text.includes('SELECT') && text.includes('current_user')) {
          return {
            rows: [
              {
                current_user: 'iam_app',
                session_user: 'iam_app',
                current_role: 'iam_app',
                app_instance_id: values?.[0] ?? 'de-musterhausen',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    return fn(client);
  }),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./role-audit.js', () => ({
  getRoleDisplayName: vi.fn((role: { display_name?: string; role_name?: string }) => role.display_name ?? role.role_name ?? 'role'),
  getRoleExternalName: vi.fn((role: { external_role_name?: string; role_name?: string }) => role.external_role_name ?? role.role_name ?? 'role'),
  mapRoleSyncErrorCode: vi.fn(() => 'SYNC_FAILED'),
  sanitizeRoleErrorMessage: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

import { reconcilePlaceholderInternal } from './reconcile-handler';
import { runRoleCatalogReconciliation } from './reconcile-core';

const ctx = {
  user: {
    id: 'kc-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
} as never;

describe('iam-account-management/reconcile-handler internals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-reconcile',
        traceId: 'trace-reconcile',
      },
    };
    state.identityProvider = {
      provider: {
        listRoles: vi.fn(async () => []),
        getRoleByName: vi.fn(async () => null),
        createRole: vi.fn(async () => undefined),
        updateRole: vi.fn(async () => undefined),
      },
    };
    state.dbRoles = [];
    state.insertShouldFail = false;
  });

  it('creates missing identity roles for studio-managed db roles and updates the drift backlog', async () => {
    state.dbRoles = [
      {
        id: '11111111-1111-1111-8111-111111111111',
        role_key: 'editor',
        role_name: 'editor',
        display_name: 'Editor',
        external_role_name: 'Editor',
        description: 'Editor role',
        is_system_role: false,
        role_level: 10,
        managed_by: 'studio',
        sync_state: 'failed',
        last_synced_at: null,
        last_error_code: 'SYNC_FAILED',
      },
    ];

    const report = await runRoleCatalogReconciliation({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-reconcile',
      traceId: 'trace-reconcile',
    });

    expect(report.correctedCount).toBe(1);
    expect(report.roles).toEqual([
      expect.objectContaining({
        roleId: '11111111-1111-1111-8111-111111111111',
        roleKey: 'editor',
        externalRoleName: 'Editor',
        action: 'create',
        status: 'corrected',
      }),
    ]);
    expect(state.identityProvider?.provider.createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        externalName: 'Editor',
        attributes: expect.objectContaining({
          managedBy: 'studio',
          instanceId: 'de-musterhausen',
          roleKey: 'editor',
          displayName: 'Editor',
        }),
      })
    );
    expect(state.setRoleDriftBacklog).toHaveBeenCalledWith('de-musterhausen', 0);
  });

  it('reports failed role imports from identity provider roles and exposes diagnostics when enabled', async () => {
    state.identityProvider = {
      provider: {
        listRoles: vi.fn(async () => [
          {
            externalName: 'Realm Editor',
            description: 'Editor role',
            clientRole: false,
            attributes: {
              managed_by: ['studio'],
              instance_id: ['de-musterhausen'],
              role_key: ['editor'],
              display_name: ['Editor'],
              role_level: ['10'],
            },
          },
        ]),
        getRoleByName: vi.fn(async () => null),
        createRole: vi.fn(async () => undefined),
        updateRole: vi.fn(async () => undefined),
      },
    };
    state.insertShouldFail = true;

    const report = await runRoleCatalogReconciliation({
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-reconcile',
      traceId: 'trace-reconcile',
      includeDiagnostics: true,
    });

    expect(report.failedCount).toBe(1);
    expect(report.debug?.importFailures).toEqual([
      expect.objectContaining({
        roleKey: 'editor',
        externalRoleName: 'Realm Editor',
        errorMessage: 'insert failed',
      }),
    ]);
    expect(report.roles).toEqual([
      expect.objectContaining({
        roleKey: 'editor',
        externalRoleName: 'Realm Editor',
        action: 'create',
        status: 'failed',
        errorCode: 'SYNC_FAILED',
      }),
    ]);
  });

  it('maps reconciliation execution failures to keycloak_unavailable in the route handler', async () => {
    state.identityProvider = null;

    const response = await reconcilePlaceholderInternal(
      new Request('http://localhost/api/v1/iam/admin/reconcile', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'keycloak_unavailable',
        message: 'Rollen-Reconciliation konnte nicht ausgeführt werden.',
        details: {
          syncState: 'failed',
          syncError: { code: 'SYNC_FAILED' },
        },
      },
      requestId: 'req-reconcile',
    });
  });

  it('delegates platform reconciliation without tenant actor resolution', async () => {
    const { reconcilePlatformRolesInternal } = await import('./platform-iam-handlers.js');
    const { resolveActorInfo } = await import('./shared.js');
    const platformResponse = new Response(JSON.stringify({ data: { outcome: 'success' } }), { status: 200 });
    vi.mocked(reconcilePlatformRolesInternal).mockResolvedValueOnce(platformResponse);
    const platformCtx = {
      user: {
        id: 'kc-platform-admin',
        roles: ['system_admin'],
      },
    } as never;
    const request = new Request('http://localhost/api/v1/iam/admin/reconcile', { method: 'POST' });

    const response = await reconcilePlaceholderInternal(request, platformCtx);

    expect(response).toBe(platformResponse);
    expect(reconcilePlatformRolesInternal).toHaveBeenCalledWith(request, platformCtx, 'req-reconcile', undefined);
    expect(resolveActorInfo).not.toHaveBeenCalled();
  });
});
