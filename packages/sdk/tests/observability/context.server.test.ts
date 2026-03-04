import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MissingWorkspaceIdError,
  createWorkspaceContextMiddleware,
  extractWorkspaceId,
  getWorkspaceContext,
  runWithWorkspaceContext,
  setWorkspaceContext,
} from '../../src/observability/context.server';

describe('workspace context', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts workspace id from case-insensitive headers and array values', () => {
    const fromLowercase = extractWorkspaceId({ 'x-workspace-id': 'ws-lower' }, ['X-Workspace-Id']);
    const fromArray = extractWorkspaceId({ 'x-sva-workspace-id': ['ws-array'] }, ['x-sva-workspace-id']);
    const fromEmptyArray = extractWorkspaceId(
      { 'x-workspace-id': [], 'x-sva-workspace-id': ['ws-fallback'] },
      ['x-workspace-id', 'x-sva-workspace-id']
    );

    expect(fromLowercase).toBe('ws-lower');
    expect(fromArray).toBe('ws-array');
    expect(fromEmptyArray).toBe('ws-fallback');
  });

  it('returns undefined when headers are missing or empty', () => {
    expect(extractWorkspaceId(undefined, ['x-workspace-id'])).toBeUndefined();
    expect(extractWorkspaceId({}, ['x-workspace-id'])).toBeUndefined();
    expect(extractWorkspaceId({ 'x-workspace-id': [''] }, ['x-workspace-id'])).toBeUndefined();
  });

  it('updates context values only within active async-local context', () => {
    setWorkspaceContext({ workspaceId: 'outside' });
    expect(getWorkspaceContext()).toEqual({});

    runWithWorkspaceContext({ workspaceId: 'ws-1', requestId: 'req-1' }, () => {
      expect(getWorkspaceContext()).toEqual({ workspaceId: 'ws-1', requestId: 'req-1' });
      setWorkspaceContext({ userId: 'user-1' });
      expect(getWorkspaceContext()).toEqual({
        workspaceId: 'ws-1',
        requestId: 'req-1',
        userId: 'user-1',
      });
    });
  });

  it('rejects missing workspace id in non-development environments', () => {
    const middleware = createWorkspaceContextMiddleware({ environment: 'production' });
    const next = vi.fn<(error?: Error) => void>();

    middleware({ headers: {} }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(MissingWorkspaceIdError);
    expect(error?.message).toBe('workspace_id header missing');
  });

  it('warns in development and continues when workspace id is missing', () => {
    const emitWarningSpy = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    const middleware = createWorkspaceContextMiddleware({
      environment: 'development',
      headerNames: ['x-custom-workspace'],
    });

    let observedContext: ReturnType<typeof getWorkspaceContext> | undefined;
    const next = vi.fn((error?: Error) => {
      expect(error).toBeUndefined();
      observedContext = getWorkspaceContext();
    });

    middleware({ headers: { 'x-another-header': 'value' } }, {}, next);

    expect(emitWarningSpy).toHaveBeenCalledTimes(1);
    expect(emitWarningSpy).toHaveBeenCalledWith('[WorkspaceContext] workspace_id header missing', {
      code: 'SVA_WORKSPACE_CONTEXT',
      detail: JSON.stringify({
        header_names: ['x-custom-workspace'],
        headers_present: ['x-another-header'],
      }),
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(observedContext).toEqual({ workspaceId: undefined });
  });

  it('sets workspace id in middleware context when header exists', () => {
    const middleware = createWorkspaceContextMiddleware({ environment: 'test' });

    let observedContext: ReturnType<typeof getWorkspaceContext> | undefined;
    const next = vi.fn((error?: Error) => {
      expect(error).toBeUndefined();
      observedContext = getWorkspaceContext();
    });

    middleware({ headers: { 'x-workspace-id': 'ws-123' } }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(observedContext).toEqual({ workspaceId: 'ws-123' });
  });
});
