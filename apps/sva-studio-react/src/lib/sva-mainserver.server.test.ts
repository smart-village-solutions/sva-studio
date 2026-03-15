import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost'),
  withAuthenticatedUser: vi.fn(),
  getSvaMainserverConnectionStatus: vi.fn(),
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (handler: () => Promise<unknown>) => handler,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => state.request,
}));

vi.mock('@sva/auth/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  getSvaMainserverConnectionStatus: state.getSvaMainserverConnectionStatus,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

describe('loadSvaMainserverConnectionStatus', () => {
  beforeEach(() => {
    state.withAuthenticatedUser.mockReset();
    state.getSvaMainserverConnectionStatus.mockReset();
    state.logger.warn.mockReset();
    state.logger.info.mockReset();
    state.logger.debug.mockReset();
    state.logger.error.mockReset();
  });

  it('delegates to the mainserver package for allowed roles', async () => {
    state.getSvaMainserverConnectionStatus.mockResolvedValue({
      status: 'connected',
      checkedAt: '2026-03-14T00:00:00.000Z',
      queryRootTypename: 'Query',
      mutationRootTypename: 'Mutation',
    });
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['interface_manager'],
          },
        })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'connected',
      queryRootTypename: 'Query',
    });
    expect(state.getSvaMainserverConnectionStatus).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
    expect(state.logger.warn).not.toHaveBeenCalled();
  });

  it('returns a stable forbidden payload when local studio roles are missing and emits an audit log', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            instanceId: 'de-musterhausen',
            roles: ['editor'],
          },
        })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
    });
    expect(state.getSvaMainserverConnectionStatus).not.toHaveBeenCalled();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'SVA Mainserver access denied by local studio role check',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
        decision: 'deny',
        reason: 'missing_local_role',
      })
    );
  });

  it('returns a stable error payload when the session has no instance context', async () => {
    state.withAuthenticatedUser.mockImplementation(
      async (_request: Request, handler: (ctx: { user: { id: string; instanceId?: string; roles: string[] } }) => Promise<Response>) =>
        handler({
          user: {
            id: 'subject-1',
            roles: ['interface_manager'],
          },
        })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
      errorMessage: 'Kein Instanzkontext in der aktuellen Session vorhanden.',
    });
    expect(state.getSvaMainserverConnectionStatus).not.toHaveBeenCalled();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'SVA Mainserver access denied because the session has no instance context',
      expect.objectContaining({
        workspace_id: 'unknown',
        decision: 'deny',
        reason: 'missing_instance_context',
      })
    );
  });

  it('returns a stable unauthorized payload when auth middleware answers with 401', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'unauthorized',
      errorMessage: 'Nicht authentifiziert. Bitte erneut anmelden.',
    });
  });

  it('maps non-contract 403 payloads to a stable forbidden status', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
      errorMessage: 'Zugriff auf die Mainserver-Diagnostik ist nicht erlaubt.',
    });
  });

  it('maps unexpected non-200 responses to a stable fallback error', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response('upstream unavailable', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const { loadSvaMainserverConnectionStatus } = await import('./sva-mainserver.server');

    await expect(loadSvaMainserverConnectionStatus()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'forbidden',
      errorMessage: 'Unerwartete Antwort beim Laden des Mainserver-Status (502).',
    });
  });
});
