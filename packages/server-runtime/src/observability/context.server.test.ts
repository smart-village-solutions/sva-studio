import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MissingWorkspaceIdError,
  createWorkspaceContextMiddleware,
  extractWorkspaceId,
  getWorkspaceContext,
  runWithoutWorkspaceContext,
  runWithWorkspaceContext,
  setWorkspaceContext,
} from './context.server.js';

describe('workspace observability context', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores and updates context within an async local scope', () => {
    expect(getWorkspaceContext()).toEqual({});

    const result = runWithWorkspaceContext({ workspaceId: 'tenant-a', requestId: 'req-1' }, () => {
      setWorkspaceContext({ traceId: 'trace-1', userId: 'user-1' });
      return getWorkspaceContext();
    });

    expect(result).toEqual({
      workspaceId: 'tenant-a',
      requestId: 'req-1',
      traceId: 'trace-1',
      userId: 'user-1',
    });
    expect(getWorkspaceContext()).toEqual({});
  });

  it('ignores context updates outside an active scope', () => {
    setWorkspaceContext({ workspaceId: 'ignored' });

    expect(getWorkspaceContext()).toEqual({});
  });

  it('detaches independent async work and restores the surrounding context', async () => {
    await runWithWorkspaceContext({ workspaceId: 'tenant-a', requestId: 'req-1' }, async () => {
      const detachedContext = await runWithoutWorkspaceContext(async () => {
        await Promise.resolve();
        return getWorkspaceContext();
      });

      expect(detachedContext).toEqual({});
      expect(getWorkspaceContext()).toEqual({ workspaceId: 'tenant-a', requestId: 'req-1' });
    });
  });

  it('extracts workspace ids from configured header variants', () => {
    expect(
      extractWorkspaceId(
        {
          'x-workspace-id': ['tenant-a', 'tenant-b'],
          'x-sva-workspace-id': 'fallback',
        },
        ['x-workspace-id', 'x-sva-workspace-id']
      )
    ).toBe('tenant-a');

    expect(
      extractWorkspaceId(
        {
          'X-Custom-Workspace': 'tenant-custom',
        },
        ['X-Custom-Workspace']
      )
    ).toBe('tenant-custom');

    expect(extractWorkspaceId(undefined, ['x-workspace-id'])).toBeUndefined();
  });

  it('creates request context middleware for present workspace headers', () => {
    const next = vi.fn();
    const middleware = createWorkspaceContextMiddleware({ environment: 'production' });

    middleware({ headers: { 'x-workspace-id': 'tenant-a' } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects missing workspace ids outside development', () => {
    const next = vi.fn();
    const middleware = createWorkspaceContextMiddleware({ environment: 'production' });

    middleware({ headers: {} }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(MissingWorkspaceIdError));
  });

  it('warns but continues for missing workspace ids in development', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const next = vi.fn();
    const middleware = createWorkspaceContextMiddleware({ environment: 'development' });

    middleware({ headers: {} }, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(emitWarning).toHaveBeenCalledWith(
      '[WorkspaceContext] workspace_id header missing',
      expect.objectContaining({ code: 'SVA_WORKSPACE_CONTEXT' })
    );
  });

  it('shares request context across separately evaluated runtime module copies', async () => {
    const firstRuntime = await import('./context.server.js');
    vi.resetModules();
    const secondRuntime = await import('./context.server.js');

    const observedContext = firstRuntime.runWithWorkspaceContext(
      { workspaceId: 'tenant-a', requestId: 'req-shared' },
      () => secondRuntime.getWorkspaceContext()
    );

    expect(observedContext).toEqual({ workspaceId: 'tenant-a', requestId: 'req-shared' });
  });
});
