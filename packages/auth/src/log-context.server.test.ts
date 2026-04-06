import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  workspaceContext: {
    workspaceId: 'workspace-from-context',
    requestId: 'request-123',
  },
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => state.workspaceContext,
}));

import { buildLogContext, isTokenErrorLike } from './log-context.server';

describe('log-context.server', () => {
  it('buildLogContext prefers explicit workspace id', () => {
    expect(buildLogContext('explicit-workspace')).toEqual({
      workspace_id: 'explicit-workspace',
      scope_kind: 'instance',
      instance_id: 'explicit-workspace',
      request_id: 'request-123',
    });
  });

  it('buildLogContext falls back to workspace context and default', () => {
    expect(buildLogContext()).toEqual({
      workspace_id: 'workspace-from-context',
      request_id: 'request-123',
    });

    state.workspaceContext = {
      workspaceId: undefined,
      requestId: 'request-456',
    } as unknown as typeof state.workspaceContext;

    expect(buildLogContext()).toEqual({
      workspace_id: 'default',
      request_id: 'request-456',
    });
  });

  it('detects OAuth/token-shaped errors', () => {
    expect(isTokenErrorLike({ name: 'TokenExpiredError' })).toBe(true);
    expect(isTokenErrorLike({ name: 'SomeOauthFailure' })).toBe(true);
    expect(isTokenErrorLike({ code: 'invalid_token' })).toBe(true);
    expect(isTokenErrorLike({ error: 'invalid_grant' })).toBe(true);
  });

  it('returns false for non token-like values', () => {
    expect(isTokenErrorLike(null)).toBe(false);
    expect(isTokenErrorLike('nope')).toBe(false);
    expect(isTokenErrorLike({ name: 'DatabaseError', code: 'db_down' })).toBe(false);
  });
});
