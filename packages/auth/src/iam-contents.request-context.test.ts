import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  workspaceContext: { requestId: 'req-content', traceId: 'trace-content' },
  withRequestContext: vi.fn(async (_options: unknown, work: () => Promise<unknown>) => work()),
  withAuthenticatedUser: vi.fn(),
  ensureFeature: vi.fn(),
  getFeatureFlags: vi.fn(() => ({ iam_admin: true })),
  requireRoles: vi.fn(),
  resolveActorInfo: vi.fn(),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  toJsonErrorResponse: vi.fn((status: number, code: string, message: string, options?: { requestId?: string }) =>
    new Response(JSON.stringify({ error: code, message, ...(options?.requestId ? { requestId: options.requestId } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => state.workspaceContext,
  toJsonErrorResponse: (...args: Parameters<typeof state.toJsonErrorResponse>) => state.toJsonErrorResponse(...args),
  withRequestContext: (...args: Parameters<typeof state.withRequestContext>) => state.withRequestContext(...args),
}));

vi.mock('./iam-account-management/api-helpers.js', () => ({
  createApiError: (...args: Parameters<typeof state.createApiError>) => state.createApiError(...args),
}));

vi.mock('./iam-account-management/feature-flags.js', () => ({
  ensureFeature: (...args: Parameters<typeof state.ensureFeature>) => state.ensureFeature(...args),
  getFeatureFlags: () => state.getFeatureFlags(),
}));

vi.mock('./iam-account-management/shared.js', () => ({
  logger: state.logger,
  requireRoles: (...args: Parameters<typeof state.requireRoles>) => state.requireRoles(...args),
  resolveActorInfo: (...args: Parameters<typeof state.resolveActorInfo>) => state.resolveActorInfo(...args),
}));

vi.mock('./middleware.server.js', () => ({
  withAuthenticatedUser: (...args: Parameters<typeof state.withAuthenticatedUser>) => state.withAuthenticatedUser(...args),
}));

import {
  resolveContentActor,
  withAuthenticatedContentHandler,
  withContentRequestContext,
} from './iam-contents/request-context.js';

describe('iam-contents request-context', () => {
  beforeEach(() => {
    state.withRequestContext.mockClear();
    state.withAuthenticatedUser.mockReset();
    state.ensureFeature.mockReset();
    state.getFeatureFlags.mockClear();
    state.requireRoles.mockReset();
    state.resolveActorInfo.mockReset();
    state.createApiError.mockClear();
    state.toJsonErrorResponse.mockClear();
    state.logger.error.mockClear();
    state.workspaceContext = { requestId: 'req-content', traceId: 'trace-content' };
  });

  it('wraps work with the content request context defaults', async () => {
    const response = await withContentRequestContext(new Request('http://localhost/api/v1/iam/contents'), async () => 'ok');

    expect(response).toBe('ok');
    expect(state.withRequestContext).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackWorkspaceId: 'default' }),
      expect.any(Function)
    );
  });

  it('delegates authenticated handlers and returns their response', async () => {
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
        sessionId: 'session-1',
      })
    );

    const response = await withAuthenticatedContentHandler(
      new Request('http://localhost/api/v1/iam/contents'),
      async (_request, ctx) => new Response(ctx.user.name)
    );

    expect(await response.text()).toBe('Editor');
  });

  it('returns a flat internal error response when auth handling throws unexpectedly', async () => {
    state.withAuthenticatedUser.mockRejectedValue(new Error('boom'));

    const response = await withAuthenticatedContentHandler(
      new Request('http://localhost/api/v1/iam/contents'),
      async () => new Response('ok')
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'internal_error',
      message: 'Unbehandelter Inhaltsfehler.',
      requestId: 'req-content',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM content request failed unexpectedly',
      expect.objectContaining({ error_message: 'boom', trace_id: 'trace-content' })
    );
  });

  it('logs non-error throwables from auth handling', async () => {
    state.withAuthenticatedUser.mockRejectedValue('boom');

    const response = await withAuthenticatedContentHandler(
      new Request('http://localhost/api/v1/iam/contents'),
      async () => new Response('ok')
    );

    expect(response.status).toBe(500);
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM content request failed unexpectedly',
      expect.objectContaining({ error_type: 'string', error_message: 'boom' })
    );
  });

  it('returns feature, role, actor and missing-account errors before producing a content actor', async () => {
    const request = new Request('http://localhost/api/v1/iam/contents');
    const ctx = {
      user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
      sessionId: 'session-1',
    };

    const featureError = new Response('feature-disabled', { status: 403 });
    state.ensureFeature.mockReturnValueOnce(featureError);
    expect(await resolveContentActor(request, ctx)).toEqual({ error: featureError });

    state.ensureFeature.mockReturnValueOnce(null);
    const roleError = new Response('forbidden', { status: 403 });
    state.requireRoles.mockReturnValueOnce(roleError);
    expect(await resolveContentActor(request, ctx)).toEqual({ error: roleError });

    state.requireRoles.mockReturnValueOnce(null);
    const actorError = new Response('actor-error', { status: 403 });
    state.resolveActorInfo.mockResolvedValueOnce({ error: actorError });
    expect(await resolveContentActor(request, ctx)).toEqual({ error: actorError });

    state.resolveActorInfo.mockResolvedValueOnce({
      actor: {
        instanceId: 'de-musterhausen',
        requestId: 'req-content',
        traceId: 'trace-content',
      },
    });
    const missingAccount = await resolveContentActor(request, ctx, { requireActorAccountId: true });
    expect('error' in missingAccount && missingAccount.error.status).toBe(403);
    expect(state.createApiError).toHaveBeenCalledWith(403, 'forbidden', 'Akteur-Account nicht gefunden.', 'req-content');
  });

  it('returns the resolved actor payload for allowed content requests', async () => {
    state.ensureFeature.mockReturnValue(null);
    state.requireRoles.mockReturnValue(null);
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-content',
        traceId: 'trace-content',
      },
    });

    const result = await resolveContentActor(
      new Request('http://localhost/api/v1/iam/contents'),
      {
        user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
        sessionId: 'session-1',
      }
    );

    expect(result).toEqual({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        actorDisplayName: 'Editor',
        requestId: 'req-content',
        traceId: 'trace-content',
      },
    });
  });

  it('keeps actorAccountId undefined when it is optional', async () => {
    state.ensureFeature.mockReturnValue(null);
    state.requireRoles.mockReturnValue(null);
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-musterhausen',
        requestId: 'req-content',
        traceId: 'trace-content',
      },
    });

    const result = await resolveContentActor(
      new Request('http://localhost/api/v1/iam/contents'),
      {
        user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
        sessionId: 'session-1',
      }
    );

    expect(result).toEqual({
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: undefined,
        actorDisplayName: 'Editor',
        requestId: 'req-content',
        traceId: 'trace-content',
      },
    });
  });
});
