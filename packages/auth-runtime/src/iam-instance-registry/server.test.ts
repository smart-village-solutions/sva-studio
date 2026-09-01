import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  withRequestContext: vi.fn(async (_input: unknown, work: () => Promise<Response>) => work()),
  getInstanceAuditRunInternal: vi.fn(async () => new Response('collection', { status: 200 })),
  getSingleInstanceAuditRunInternal: vi.fn(async () => new Response('detail', { status: 200 })),
  authenticateRegistryServiceToken: vi.fn(),
  markAuthenticatedRegistryServiceRequest: vi.fn(),
  resolvePluginTenantLifecycleServiceAction: vi.fn(),
  prepareInstanceConfirmationInternal: vi.fn(
    async () => new Response('confirmation', { status: 200 })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
  toSafeLogPath: (value: string) => new URL(value).pathname,
  toJsonErrorResponse: vi.fn(
    (status: number, code: string, message?: string, options?: { requestId?: string }) =>
      new Response(JSON.stringify({ code, message, requestId: options?.requestId }), { status })
  ),
  withRequestContext: state.withRequestContext,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('./service-token.js', () => ({
  authenticateRegistryServiceToken: state.authenticateRegistryServiceToken,
  markAuthenticatedRegistryServiceRequest: state.markAuthenticatedRegistryServiceRequest,
  readBearerToken: (request: Request) => {
    const value = request.headers.get('authorization');
    if (value === null) return undefined;
    return value.startsWith('Bearer ') ? value.slice(7) : null;
  },
}));

vi.mock('./confirmation.js', () => ({
  prepareInstanceConfirmationInternal: state.prepareInstanceConfirmationInternal,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ request_id: 'req-1' })),
}));

vi.mock('./core.js', () => ({
  activateInstanceInternal: vi.fn(async () => new Response('activate', { status: 200 })),
  archiveInstanceInternal: vi.fn(async () => new Response('archive', { status: 200 })),
  assignInstanceModuleInternal: vi.fn(async () => new Response('assign', { status: 200 })),
  bootstrapInstanceAdminStructureInternal: vi.fn(
    async () => new Response('bootstrap', { status: 200 })
  ),
  createInstanceInternal: vi.fn(async () => new Response('create', { status: 200 })),
  getInstanceInternal: vi.fn(async () => new Response('get', { status: 200 })),
  listInstancesInternal: vi.fn(async () => new Response('list', { status: 200 })),
  revokeInstanceModuleInternal: vi.fn(async () => new Response('revoke', { status: 200 })),
  seedInstanceIamBaselineInternal: vi.fn(async () => new Response('seed', { status: 200 })),
  suspendInstanceInternal: vi.fn(async () => new Response('suspend', { status: 200 })),
  updateInstanceInternal: vi.fn(async () => new Response('update', { status: 200 })),
}));

vi.mock('./core-keycloak.js', () => ({
  executeInstanceKeycloakProvisioningInternal: vi.fn(
    async () => new Response('execute', { status: 200 })
  ),
  getInstanceAuditRunInternal: state.getInstanceAuditRunInternal,
  getInstanceKeycloakPreflightInternal: vi.fn(
    async () => new Response('preflight', { status: 200 })
  ),
  getInstanceKeycloakProvisioningRunInternal: vi.fn(
    async () => new Response('run', { status: 200 })
  ),
  getInstanceKeycloakStatusInternal: vi.fn(async () => new Response('status', { status: 200 })),
  getSingleInstanceAuditRunInternal: state.getSingleInstanceAuditRunInternal,
  planInstanceKeycloakProvisioningInternal: vi.fn(
    async () => new Response('plan', { status: 200 })
  ),
  probeTenantIamAccessInternal: vi.fn(async () => new Response('probe', { status: 200 })),
  reconcileInstanceKeycloakInternal: vi.fn(async () => new Response('reconcile', { status: 200 })),
  reconcileInstanceIamRolesInternal: vi.fn(
    async () => new Response('roles-reconcile', { status: 200 })
  ),
  rotateInstanceSecretInternal: vi.fn(async () => new Response('rotate', { status: 200 })),
}));

vi.mock('../plugin-tenant-lifecycle/http.js', () => ({
  getPluginTenantReadinessInternal: vi.fn(
    async () => new Response('plugin-readiness', { status: 200 })
  ),
  startPluginTenantLifecycleInternal: vi.fn(
    async () => new Response('plugin-lifecycle', { status: 200 })
  ),
  resolvePluginTenantLifecycleServiceAction: state.resolvePluginTenantLifecycleServiceAction,
}));

const lifecycleEndpointActions = [
  { operation: undefined, actionId: 'instance.pluginLifecycle.read' },
  { operation: 'provision', actionId: 'instance.pluginLifecycle.provision' },
  { operation: 'readiness', actionId: 'instance.pluginLifecycle.readiness' },
  { operation: 'reconcile', actionId: 'instance.pluginLifecycle.reconcile' },
  { operation: 'suspend', actionId: 'instance.pluginLifecycle.suspend' },
  { operation: 'reactivate', actionId: 'instance.pluginLifecycle.reactivate' },
] as const;

const lifecycleEndpointActionMatrix = lifecycleEndpointActions.flatMap((endpoint) =>
  lifecycleEndpointActions.map(
    ({ actionId: credentialAction }) =>
      [
        endpoint.operation ?? 'read',
        credentialAction,
        endpoint,
        endpoint.actionId === credentialAction,
      ] as const
  )
);

describe('iam-instance-registry/server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withAuthenticatedUser.mockImplementation(
      async (request: Request, work: (ctx: unknown) => Promise<Response>) =>
        work({ user: { id: 'admin-1' }, request } as never)
    );
    state.authenticateRegistryServiceToken.mockResolvedValue({
      kind: 'authenticated',
      context: {
        authKind: 'keycloak_service',
        actionId: 'instance.create',
        user: { id: 'service-1', roles: ['instance_registry_admin'] },
      },
    });
    state.resolvePluginTenantLifecycleServiceAction.mockResolvedValue(
      'instance.pluginLifecycle.reconcile'
    );
  });

  it('gives Bearer authentication precedence and binds the route action statically', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const request = new Request('https://studio.example.org/api/v1/iam/instances', {
      method: 'POST',
      headers: { authorization: 'Bearer signed-token', cookie: 'session=browser-session' },
    });

    const response = await instanceRegistryHandlers.createInstance(request);

    expect(response.status).toBe(200);
    expect(state.authenticateRegistryServiceToken).toHaveBeenCalledWith(
      'signed-token',
      'instance.create'
    );
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
    expect(state.markAuthenticatedRegistryServiceRequest).toHaveBeenCalledWith(request);
  });

  it('never falls back to a browser session for malformed Authorization', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const request = new Request('https://studio.example.org/api/v1/iam/instances', {
      headers: { authorization: 'Basic abc', cookie: 'session=browser-session' },
    });

    const response = await instanceRegistryHandlers.listInstances(request);

    expect(response.status).toBe(401);
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('binds readiness reads and lifecycle mutations to separate service actions', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const readinessRequest = new Request(
      'https://studio.example.org/api/v1/iam/instances/tenant-a/plugin-readiness',
      { headers: { authorization: 'Bearer read-token' } }
    );
    const lifecycleRequest = new Request(
      'https://studio.example.org/api/v1/iam/instances/tenant-a/plugin-readiness',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer operation-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pluginId: 'speech', operation: 'suspend' }),
      }
    );
    state.resolvePluginTenantLifecycleServiceAction.mockResolvedValueOnce(
      'instance.pluginLifecycle.suspend'
    );

    await instanceRegistryHandlers.getPluginTenantReadiness(readinessRequest);
    await instanceRegistryHandlers.startPluginTenantLifecycle(lifecycleRequest);

    expect(state.authenticateRegistryServiceToken).toHaveBeenNthCalledWith(
      1,
      'read-token',
      'instance.pluginLifecycle.read'
    );
    expect(state.resolvePluginTenantLifecycleServiceAction).toHaveBeenCalledWith(lifecycleRequest);
    expect(state.authenticateRegistryServiceToken).toHaveBeenNthCalledWith(
      2,
      'operation-token',
      'instance.pluginLifecycle.suspend'
    );
  });

  it.each(lifecycleEndpointActionMatrix)(
    'binds %s endpoint against credential %s',
    async (_endpointName, credentialAction, endpoint, expectedAccepted) => {
      state.authenticateRegistryServiceToken.mockImplementation(
        async (_token: string, requiredAction: string) =>
          requiredAction === credentialAction
            ? {
                kind: 'authenticated',
                context: {
                  authKind: 'keycloak_service',
                  actionId: requiredAction,
                  user: { id: 'service-1', roles: ['instance_registry_admin'] },
                },
              }
            : {
                kind: 'response',
                response: new Response(
                  JSON.stringify({ error: { code: 'missing_action_scope' } }),
                  { status: 403 }
                ),
              }
      );
      if (endpoint.operation) {
        state.resolvePluginTenantLifecycleServiceAction.mockResolvedValueOnce(endpoint.actionId);
      }
      const { instanceRegistryHandlers } = await import('./server.js');
      const request = new Request(
        'https://studio.example.org/api/v1/iam/instances/tenant-a/plugin-readiness',
        endpoint.operation
          ? {
              method: 'POST',
              headers: {
                authorization: `Bearer ${credentialAction}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ pluginId: 'speech', operation: endpoint.operation }),
            }
          : { headers: { authorization: `Bearer ${credentialAction}` } }
      );

      const response = endpoint.operation
        ? await instanceRegistryHandlers.startPluginTenantLifecycle(request)
        : await instanceRegistryHandlers.getPluginTenantReadiness(request);

      expect(state.authenticateRegistryServiceToken).toHaveBeenCalledWith(
        credentialAction,
        endpoint.actionId
      );
      expect(response.status).toBe(expectedAccepted ? 200 : 403);
      expect(state.markAuthenticatedRegistryServiceRequest).toHaveBeenCalledTimes(
        expectedAccepted ? 1 : 0
      );
      if (endpoint.operation) {
        expect(state.resolvePluginTenantLifecycleServiceAction).toHaveBeenCalledWith(request);
      } else {
        expect(state.resolvePluginTenantLifecycleServiceAction).not.toHaveBeenCalled();
      }
      if (!expectedAccepted) {
        await expect(response.json()).resolves.toMatchObject({
          error: { code: 'missing_action_scope' },
        });
      }
    }
  );

  it('rejects invalid lifecycle bodies before selecting or authenticating an action', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const invalidResponse = new Response(null, { status: 400 });
    state.resolvePluginTenantLifecycleServiceAction.mockResolvedValueOnce(invalidResponse);
    const request = new Request(
      'https://studio.example.org/api/v1/iam/instances/tenant-a/plugin-readiness',
      {
        method: 'POST',
        headers: { authorization: 'Bearer operation-token' },
        body: 'invalid',
      }
    );

    const response = await instanceRegistryHandlers.startPluginTenantLifecycle(request);

    expect(response).toBe(invalidResponse);
    expect(state.authenticateRegistryServiceToken).not.toHaveBeenCalled();
  });

  it('routes audit requests through the authenticated registry handler', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const collectionRequest = new Request('https://studio.example.org/api/v1/iam/instances/audit');
    const detailRequest = new Request('https://studio.example.org/api/v1/iam/instances/demo/audit');

    const collectionResponse =
      await instanceRegistryHandlers.getInstanceAuditRun(collectionRequest);
    const detailResponse = await instanceRegistryHandlers.getSingleInstanceAuditRun(detailRequest);

    expect(collectionResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(state.withRequestContext).toHaveBeenCalledTimes(2);
    expect(state.withAuthenticatedUser).toHaveBeenCalledTimes(2);
    expect(state.getInstanceAuditRunInternal).toHaveBeenCalledWith(
      collectionRequest,
      expect.objectContaining({ user: { id: 'admin-1' } })
    );
    expect(state.getSingleInstanceAuditRunInternal).toHaveBeenCalledWith(
      detailRequest,
      expect.objectContaining({ user: { id: 'admin-1' } })
    );
  });

  it('exposes every registry operation through the session-authenticated wrapper', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const handlers = Object.values(instanceRegistryHandlers);
    const responses = await Promise.all(
      handlers.map((handler) =>
        handler(new Request('https://studio.example.org/api/v1/iam/instances/demo'))
      )
    );

    expect(responses).toHaveLength(25);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(state.withAuthenticatedUser).toHaveBeenCalledTimes(25);
    expect(state.prepareInstanceConfirmationInternal).toHaveBeenCalledOnce();
  });
});
