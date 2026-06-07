import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoleReadHandlers, type RoleReadHandlerDeps } from './role-read-handlers.js';

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

const platformCtx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-platform-admin',
    roles: ['instance_registry_admin'],
  },
};

const actor = {
  instanceId: 'de-musterhausen',
  requestId: 'req-roles',
};

const roles = [{ id: 'role-1', roleKey: 'editor' }];
const permissions = [{ id: 'perm-1', permissionKey: 'contents.read' }];

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createDeps = (overrides: Partial<RoleReadHandlerDeps<(typeof roles)[number], (typeof permissions)[number]>> = {}) =>
  ({
    asApiList: vi.fn((data, pagination, requestId) => ({ data, pagination, ...(requestId ? { requestId } : {}) })),
    classifyIamDiagnosticError: vi.fn(() => ({
      status: 503,
      code: 'database_unavailable',
      message: 'IAM-Datenbank ist nicht erreichbar.',
    })),
    consumeRateLimit: vi.fn(() => null),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    ensureFeature: vi.fn(() => null),
    getFeatureFlags: vi.fn(() => ({})),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-workspace', traceId: 'trace-workspace' })),
    jsonResponse: vi.fn(createJsonResponse),
    authorizeRoleReadAccess: vi.fn(async () => null),
    listPlatformRolesInternal: vi.fn(async () => createJsonResponse(200, { data: [{ id: 'platform-role' }] })),
    loadPermissions: vi.fn(async () => permissions),
    loadRoleListItems: vi.fn(async () => roles),
    requireRoles: vi.fn((requestContext, roles, requestId) =>
      requestContext.user.roles.some((role) => roles.has(role))
        ? null
        : createJsonResponse(403, { error: { code: 'forbidden', message: 'forbidden' }, requestId })
    ),
    resolveActorInfo: vi.fn(async () => ({ actor })),
    ...overrides,
  }) satisfies RoleReadHandlerDeps<(typeof roles)[number], (typeof permissions)[number]>;

describe('createRoleReadHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tenant roles with pagination metadata', async () => {
    const deps = createDeps();
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: roles,
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-roles',
    });
    expect(deps.loadRoleListItems).toHaveBeenCalledWith('de-musterhausen');
  });

  it('supports a custom access authorizer for permission-based role access', async () => {
    const authorizeRoleReadAccess = vi.fn(async () => null);
    const deps = createDeps({
      authorizeRoleReadAccess,
      requireRoles: vi.fn(() => createJsonResponse(403, { error: { code: 'forbidden', message: 'forbidden' } })),
    });
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), {
      ...ctx,
      user: { ...ctx.user, roles: ['custom_role'] },
    });

    expect(response.status).toBe(200);
    expect(authorizeRoleReadAccess).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ user: expect.objectContaining({ roles: ['custom_role'] }) }),
      'req-workspace',
      { allowPlatformRoles: true }
    );
    expect(deps.requireRoles).not.toHaveBeenCalled();
  });

  it('delegates platform role lists when no instance scope is present', async () => {
    const deps = createDeps();
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), platformCtx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'platform-role' }] });
    expect(deps.loadRoleListItems).not.toHaveBeenCalled();
  });

  it('fails closed for tenant role reads when no tenant access authorizer is configured', async () => {
    const deps = createDeps({
      authorizeRoleReadAccess: undefined,
    });
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), {
      ...ctx,
      user: { ...ctx.user, roles: ['system_admin'] },
    });

    expect(response.status).toBe(403);
    expect(deps.loadRoleListItems).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        details: { reason_code: 'missing_role_read_authorizer' },
      },
      requestId: 'req-workspace',
    });
  });

  it('lists permissions with a minimum page size of one', async () => {
    const deps = createDeps({
      loadPermissions: vi.fn(async () => []),
    });
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listPermissionsInternal(new Request('http://localhost/api/v1/iam/permissions'), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: { page: 1, pageSize: 1, total: 0 },
    });
  });

  it('maps role database failures through the diagnostic classifier', async () => {
    const deps = createDeps({
      loadRoleListItems: vi.fn(async () => {
        throw new Error('database down');
      }),
    });
    const handlers = createRoleReadHandlers(deps);

    const response = await handlers.listRolesInternal(new Request('http://localhost/api/v1/iam/roles'), ctx);

    expect(response.status).toBe(503);
    expect(deps.classifyIamDiagnosticError).toHaveBeenCalledWith(
      expect.any(Error),
      'IAM-Datenbank ist nicht erreichbar.',
      'req-roles'
    );
  });
});
