import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost'),
  withAuthenticatedUser: vi.fn(),
  getSvaMainserverConnectionStatus: vi.fn(),
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

describe('loadSvaMainserverConnectionStatus', () => {
  beforeEach(() => {
    state.withAuthenticatedUser.mockReset();
    state.getSvaMainserverConnectionStatus.mockReset();
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
  });

  it('returns a stable forbidden payload when local studio roles are missing', async () => {
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
  });
});
