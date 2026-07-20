import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers,
  type InstanceRegistryMutationHttpDeps,
} from './http-mutation-handlers.js';

type TestContext = {
  readonly userId: string;
};

const readBody = async (response: Response) => JSON.parse(await response.text());

const createDeps = (): InstanceRegistryMutationHttpDeps<TestContext> => ({
  getRequestId: () => 'req-test',
  getActor: (ctx) => ({ id: ctx.userId }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) =>
    new Response(JSON.stringify({ code, message, requestId, ...(details ? { details } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  jsonResponse: (status, payload) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  asApiItem: (value) => value,
  parseRequestBody: vi.fn(async () => ({ ok: true, data: { rotateClientSecret: false, intent: 'provision' } })),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  ensurePlatformAccess: vi.fn(() => null),
  validateCsrf: vi.fn(() => null),
  requireFreshReauth: vi.fn(() => null),
  confirmCriticalMutation: vi.fn(async () => null),
  withScopedRegistryService: vi.fn(async (_instanceId, work) =>
    work({
      reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
      executeKeycloakProvisioning: vi.fn(async () => ({ id: 'run-1' })),
      assignModule: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      bootstrapAdminStructure: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      revokeModule: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: [] } })),
      seedIamBaseline: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      probeTenantIamAccess: vi.fn(async () => ({
        access: { status: 'ready', summary: 'ok', source: 'access_probe' },
        overall: { status: 'unknown', summary: 'unknown', source: 'registry' },
        configuration: { status: 'unknown', summary: 'unknown', source: 'registry' },
        reconcile: { status: 'unknown', summary: 'unknown', source: 'role_reconcile' },
      })),
      changeStatus: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', status: 'active' } })),
    } as never)
  ),
  withRegistryService: vi.fn(async (work) =>
    work({
      reconcileKeycloak: vi.fn(async () => ({ realmExists: true })),
      executeKeycloakProvisioning: vi.fn(async () => ({ id: 'run-1' })),
      assignModule: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      bootstrapAdminStructure: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      revokeModule: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: [] } })),
      seedIamBaseline: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: ['news'] } })),
      probeTenantIamAccess: vi.fn(async () => ({
        access: { status: 'ready', summary: 'ok', source: 'access_probe' },
        overall: { status: 'unknown', summary: 'unknown', source: 'registry' },
        configuration: { status: 'unknown', summary: 'unknown', source: 'registry' },
        reconcile: { status: 'unknown', summary: 'unknown', source: 'role_reconcile' },
      })),
      changeStatus: vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', status: 'active' } })),
    } as never)
  ),
});

describe('http mutation handlers', () => {
  let deps: InstanceRegistryMutationHttpDeps<TestContext>;

  beforeEach(() => {
    deps = createDeps();
  });

  it('maps known mutation errors with stable API codes', async () => {
    const mapError = createInstanceMutationErrorMapper(deps);

    const response = mapError(new Error('tenant_auth_client_secret_missing'));
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'tenant_auth_client_secret_missing',
      requestId: 'req-test',
    });
  });

  it('reconcileInstanceKeycloak validates guards before parsing the body', async () => {
    vi.mocked(deps.ensurePlatformAccess).mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.reconcileInstanceKeycloak(
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile'),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(403);
    expect(deps.parseRequestBody).not.toHaveBeenCalled();
  });

  it('reconcileInstanceKeycloak returns not_found when the service has no instance', async () => {
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({ reconcileKeycloak: vi.fn(async () => null) } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.reconcileInstanceKeycloak(
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile'),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('passes the validated idempotency key into keycloak service mutations', async () => {
    const reconcileKeycloak = vi.fn(async () => ({ realmExists: true }));
    const executeKeycloakProvisioning = vi.fn(async () => ({ id: 'run-1' }));
    vi.mocked(deps.requireIdempotencyKey).mockReturnValue({ key: 'idem-keycloak-1' });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) => work({ reconcileKeycloak } as never))
      .mockImplementationOnce(async (_instanceId, work) => work({ executeKeycloakProvisioning } as never));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    await handlers.reconcileInstanceKeycloak(
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile'),
      { userId: 'u-1' }
    );
    await handlers.executeInstanceKeycloakProvisioning(
      new Request('http://localhost/api/instances/inst-1/keycloak/runs'),
      { userId: 'u-1' }
    );

    expect(reconcileKeycloak).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'idem-keycloak-1' }));
    expect(executeKeycloakProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'idem-keycloak-1' })
    );
  });

  it('executeInstanceKeycloakProvisioning maps thrown registry errors', async () => {
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async () => {
      throw new Error('tenant_admin_client_secret_missing');
    });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.executeInstanceKeycloakProvisioning(
      new Request('http://localhost/api/instances/inst-1/keycloak/runs'),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('tenant_admin_client_secret_missing');
  });

  it('probeTenantIamAccess returns the updated tenant IAM status', async () => {
    const probeTenantIamAccess = vi.fn(async () => ({
      access: { status: 'blocked', summary: '403', source: 'access_probe', requestId: 'req-probe-1' },
      overall: { status: 'blocked', summary: 'blocked', source: 'access_probe', requestId: 'req-probe-1' },
      configuration: { status: 'ready', summary: 'ok', source: 'registry' },
      reconcile: { status: 'unknown', summary: 'unknown', source: 'role_reconcile' },
    }));
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        probeTenantIamAccess,
      } as never)
    );
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: {} });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.probeTenantIamAccess(
      new Request('http://localhost/api/instances/inst-1/tenant-iam/access-probe', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
    expect(probeTenantIamAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-1',
        actorId: 'u-1',
        idempotencyKey: 'idem-1',
      })
    );
    await expect(readBody(response)).resolves.toMatchObject({
      access: { status: 'blocked', requestId: 'req-probe-1' },
      overall: { status: 'blocked', requestId: 'req-probe-1' },
    });
  });

  it('probeTenantIamAccess maps not_found and thrown registry errors', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValue({ ok: true, data: {} });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          probeTenantIamAccess: vi.fn(async () => null),
        } as never)
      )
      .mockImplementationOnce(async () => {
        throw new Error('tenant_admin_client_not_configured');
      });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const notFoundResponse = await handlers.probeTenantIamAccess(
      new Request('http://localhost/api/instances/inst-1/tenant-iam/access-probe', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const errorResponse = await handlers.probeTenantIamAccess(
      new Request('http://localhost/api/instances/inst-1/tenant-iam/access-probe', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(readBody(notFoundResponse)).resolves.toMatchObject({ code: 'not_found' });
    expect(errorResponse.status).toBe(409);
    await expect(readBody(errorResponse)).resolves.toMatchObject({
      code: 'tenant_admin_client_not_configured',
    });
  });

  it('reconcileInstanceKeycloak does not require fresh reauthentication', async () => {
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.reconcileInstanceKeycloak(
      new Request('http://localhost/api/instances/inst-1/keycloak/reconcile'),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('executeInstanceKeycloakProvisioning does not require fresh reauthentication', async () => {
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.executeInstanceKeycloakProvisioning(
      new Request('http://localhost/api/instances/inst-1/keycloak/runs'),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('assignModule returns idempotency and instance id errors before parsing the payload', async () => {
    vi.mocked(deps.requireIdempotencyKey)
      .mockReturnValueOnce({ error: new Response('missing idempotency', { status: 428 }) })
      .mockReturnValueOnce({ key: 'idem-1' });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const idempotencyResponse = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const missingInstanceResponse = await handlers.assignModule(
      new Request('http://localhost/api/instances', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(idempotencyResponse.status).toBe(428);
    expect(missingInstanceResponse.status).toBe(400);
    await expect(readBody(missingInstanceResponse)).resolves.toMatchObject({ code: 'invalid_instance_id' });
    expect(deps.parseRequestBody).not.toHaveBeenCalled();
  });

  it('assignModule returns invalid_request for unknown modules', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleId: 'unknown' } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        assignModule: vi.fn(async () => ({ ok: false, reason: 'unknown_module' })),
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('assignModule maps not_found and conflict results', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValue({ ok: true, data: { moduleId: 'news' } });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          assignModule: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
        } as never)
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          assignModule: vi.fn(async () => ({ ok: false, reason: 'conflict' })),
        } as never)
      );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const notFoundResponse = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const conflictResponse = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(readBody(notFoundResponse)).resolves.toMatchObject({ code: 'not_found' });
    expect(conflictResponse.status).toBe(409);
    await expect(readBody(conflictResponse)).resolves.toMatchObject({ code: 'conflict' });
  });

  it('assignModule does not require fresh reauthentication', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleId: 'news' } });
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('assignModule uses the scoped registry service and maps thrown database errors', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleId: 'news' } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async () => {
      throw new Error('new row violates row-level security policy for table "permissions"');
    });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.assignModule(
      new Request('http://localhost/api/instances/inst-1/modules/assign', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(deps.withScopedRegistryService).toHaveBeenCalledWith('inst-1', expect.any(Function));
    expect(response.status).toBe(503);
    expect(body.code).toBe('database_unavailable');
  });

  it('revokeModule returns the refreshed instance detail on success', async () => {
    const revokeModule = vi.fn(async () => ({ ok: true, instance: { instanceId: 'inst-1', assignedModules: [] } }));
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: true,
      data: { moduleId: 'news', confirmation: 'REVOKE' },
    });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        revokeModule,
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(revokeModule).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-1',
        moduleId: 'news',
        confirmation: 'REVOKE',
        idempotencyKey: 'idem-1',
      })
    );
    await expect(readBody(response)).resolves.toMatchObject({
      instanceId: 'inst-1',
      assignedModules: [],
    });
  });

  it('consumes a critical confirmation inside the scoped service callback before mutation', async () => {
    const calls: string[] = [];
    const service = {
      revokeModule: vi.fn(async () => {
        calls.push('mutation');
        return { ok: true, instance: { instanceId: 'inst-1', assignedModules: [] } };
      }),
    };
    Object.assign(deps, { confirmCriticalMutation: vi.fn(async ({ service: scopedService, actionId, moduleId }: { service: unknown; actionId: string; moduleId?: string }) => {
      expect(scopedService).toBe(service);
      expect(actionId).toBe('instance.module.revoke');
      expect(moduleId).toBe('news');
      calls.push('confirmation');
      return null;
    }) });
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleId: 'news' } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) => work(service as never));

    const response = await createInstanceRegistryMutationHttpHandlers(deps).revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'service-1' }
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual(['confirmation', 'mutation']);
  });

  it('fails closed when a critical handler has no confirmation dependency', async () => {
    Object.assign(deps, { confirmCriticalMutation: undefined });
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleId: 'news', confirmation: 'REVOKE' } });
    const response = await createInstanceRegistryMutationHttpHandlers(deps).revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'service-1' }
    );
    expect(response.status).toBe(500);
    await expect(readBody(response)).resolves.toMatchObject({ code: 'internal_error' });
  });

  it('revokeModule maps not_found, unknown_module and conflict results', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValue({ ok: true, data: { moduleId: 'news', confirmation: 'REVOKE' } });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          revokeModule: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
        } as never)
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          revokeModule: vi.fn(async () => ({ ok: false, reason: 'unknown_module' })),
        } as never)
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          revokeModule: vi.fn(async () => ({ ok: false, reason: 'conflict' })),
        } as never)
      );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const notFoundResponse = await handlers.revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const unknownModuleResponse = await handlers.revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const conflictResponse = await handlers.revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(readBody(notFoundResponse)).resolves.toMatchObject({ code: 'not_found' });
    expect(unknownModuleResponse.status).toBe(400);
    await expect(readBody(unknownModuleResponse)).resolves.toMatchObject({ code: 'invalid_request' });
    expect(conflictResponse.status).toBe(409);
    await expect(readBody(conflictResponse)).resolves.toMatchObject({ code: 'conflict' });
  });

  it('revokeModule does not require fresh reauthentication', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: true,
      data: { moduleId: 'news', confirmation: 'REVOKE' },
    });
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.revokeModule(
      new Request('http://localhost/api/instances/inst-1/modules/revoke', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('bootstrapAdminStructure passes selected module ids into the registry service', async () => {
    const bootstrapAdminStructure = vi.fn(async () => ({
      ok: true,
      instance: { instanceId: 'inst-1', assignedModules: ['news'] },
    }));
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleIds: ['news'] } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        bootstrapAdminStructure,
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.bootstrapAdminStructure(
      new Request('http://localhost/api/instances/inst-1/admin-bootstrap', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(bootstrapAdminStructure).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'inst-1',
        moduleIds: ['news'],
        idempotencyKey: 'idem-1',
      })
    );
    await expect(readBody(response)).resolves.toMatchObject({
      instanceId: 'inst-1',
      assignedModules: ['news'],
    });
  });

  it('seedIamBaseline requires an existing instance', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: {} });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        seedIamBaseline: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.seedIamBaseline(
      new Request('http://localhost/api/instances/inst-1/modules/seed-iam-baseline', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('seedIamBaseline does not require fresh reauthentication', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: {} });
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.seedIamBaseline(
      new Request('http://localhost/api/instances/inst-1/modules/seed-iam-baseline', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('bootstrapAdminStructure returns invalid_request for unknown modules', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleIds: ['unknown'] } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        bootstrapAdminStructure: vi.fn(async () => ({ ok: false, reason: 'unknown_module' })),
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.bootstrapAdminStructure(
      new Request('http://localhost/api/instances/inst-1/admin-bootstrap', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('bootstrapAdminStructure maps not_found and conflict results', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValue({ ok: true, data: { moduleIds: ['news'] } });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          bootstrapAdminStructure: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
        } as never)
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          bootstrapAdminStructure: vi.fn(async () => ({ ok: false, reason: 'conflict' })),
        } as never)
      );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const notFoundResponse = await handlers.bootstrapAdminStructure(
      new Request('http://localhost/api/instances/inst-1/admin-bootstrap', { method: 'POST' }),
      { userId: 'u-1' }
    );
    const conflictResponse = await handlers.bootstrapAdminStructure(
      new Request('http://localhost/api/instances/inst-1/admin-bootstrap', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(readBody(notFoundResponse)).resolves.toMatchObject({ code: 'not_found' });
    expect(conflictResponse.status).toBe(409);
    await expect(readBody(conflictResponse)).resolves.toMatchObject({ code: 'conflict' });
  });

  it('bootstrapAdminStructure does not require fresh reauthentication', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { moduleIds: ['news'] } });
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.bootstrapAdminStructure(
      new Request('http://localhost/api/instances/inst-1/admin-bootstrap', { method: 'POST' }),
      { userId: 'u-1' }
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });

  it('mutateInstanceStatus rejects mismatched status payloads', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { status: 'archived' } });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'active'
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('mutateInstanceStatus preserves parseRequestBody validation messages', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: false,
      message: 'Request body muss ein gueltiges JSON-Objekt sein.',
    });
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'active'
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'invalid_request',
      message: 'Request body muss ein gueltiges JSON-Objekt sein.',
    });
  });

  it('mutateInstanceStatus returns the changed instance on success', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { status: 'suspended' } });
    vi.mocked(deps.withScopedRegistryService).mockImplementationOnce(async (_instanceId, work) =>
      work({
        changeStatus: vi.fn(async () => ({
          ok: true,
          instance: { instanceId: 'inst-1', status: 'suspended' },
        })),
      } as never)
    );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'suspended'
    );
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ instanceId: 'inst-1', status: 'suspended' });
  });

  it('mutateInstanceStatus maps not_found and conflict service responses', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValue({ ok: true, data: { status: 'active' } });
    vi.mocked(deps.withScopedRegistryService)
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          changeStatus: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
        } as never)
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          changeStatus: vi.fn(async () => ({ ok: false, reason: 'conflict' })),
        } as never)
      );
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const notFoundResponse = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'active'
    );
    const conflictResponse = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'active'
    );

    expect(notFoundResponse.status).toBe(404);
    await expect(readBody(notFoundResponse)).resolves.toMatchObject({ code: 'not_found' });
    expect(conflictResponse.status).toBe(409);
    await expect(readBody(conflictResponse)).resolves.toMatchObject({ code: 'conflict' });
  });

  it('mutateInstanceStatus does not require fresh reauthentication', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({ ok: true, data: { status: 'active' } });
    vi.mocked(deps.requireFreshReauth).mockReturnValueOnce(new Response('reauth', { status: 403 }));
    const handlers = createInstanceRegistryMutationHttpHandlers(deps);

    const response = await handlers.mutateInstanceStatus(
      new Request('http://localhost/api/instances/inst-1/status'),
      { userId: 'u-1' },
      'active'
    );

    expect(response.status).toBe(200);
    expect(deps.requireFreshReauth).not.toHaveBeenCalled();
  });
});
