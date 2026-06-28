import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorizeInstancePermissionForUser: vi.fn(),
  createApiError: vi.fn(),
  capturedDeps: null as null | {
    requireSystemAdminRole: (ctx: unknown, requestId?: string) => Promise<Response | null>;
  },
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'request-1', traceId: 'trace-1' })),
}));

vi.mock('@sva/iam-admin', () => ({
  createReconcileHandlerInternal: (deps: typeof state.capturedDeps) => {
    state.capturedDeps = deps;
    return vi.fn();
  },
}));

vi.mock('../db.js', () => ({
  jsonResponse: vi.fn(),
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: (...args: unknown[]) =>
    state.authorizeInstancePermissionForUser(...args),
  toInstancePermissionApiErrorCode: (code: string) => `api_${code}`,
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: vi.fn(),
  createApiError: (...args: unknown[]) => state.createApiError(...args),
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./platform-iam-handlers.js', () => ({
  reconcilePlatformRolesInternal: vi.fn(),
}));

vi.mock('./reconcile-core.js', () => ({
  runRoleCatalogReconciliation: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  resolveActorInfo: vi.fn(),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./role-audit.js', () => ({
  mapRoleSyncErrorCode: vi.fn(() => 'unknown'),
  sanitizeRoleErrorMessage: vi.fn(() => 'sanitized'),
}));

await import('./reconcile-handler.js');

describe('reconcile-handler', () => {
  it('requires iam.role.write before tenant role reconciliation proceeds', async () => {
    const ctx = {
      sessionId: 'session-1',
      user: { id: 'subject-1', instanceId: 'instance-1', roles: [] },
    };
    const deniedResponse = new Response(null, { status: 403 });
    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Nicht erlaubt.',
    });
    state.createApiError.mockReturnValueOnce(deniedResponse);

    const response = await state.capturedDeps?.requireSystemAdminRole(ctx, 'request-1');

    expect(response).toBe(deniedResponse);
    expect(state.authorizeInstancePermissionForUser).toHaveBeenCalledWith({
      ctx,
      action: 'iam.role.write',
    });
    expect(state.createApiError).toHaveBeenCalledWith(
      403,
      'api_forbidden',
      'Nicht erlaubt.',
      'request-1'
    );
  });

  it('continues tenant role reconciliation when iam.role.write is allowed', async () => {
    const ctx = {
      sessionId: 'session-1',
      user: { id: 'subject-1', instanceId: 'instance-1', roles: [] },
    };
    state.authorizeInstancePermissionForUser.mockResolvedValueOnce({ ok: true, permissions: [] });

    await expect(state.capturedDeps?.requireSystemAdminRole(ctx, 'request-1')).resolves.toBeNull();
  });
});
