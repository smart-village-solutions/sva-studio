import { describe, expect, it, vi } from 'vitest';

import {
  createLegalTextsAdminActorResolver,
  createLegalTextsRequestContextHandlers,
  withLegalTextsRequestContext,
  type LegalTextsAdminActorResolverDeps,
  type LegalTextsRequestContextDeps,
} from './legal-text-request-context.js';

type TestContext = { userId: string };

describe('legal-text-request-context', () => {
  it('wraps authenticated legal text handlers with a request context', async () => {
    const deps: LegalTextsRequestContextDeps<TestContext> = {
      withAuthenticatedUser: vi.fn(async (_request, handler) => handler({ userId: 'u-1' })),
      logError: vi.fn(),
    };
    const handlers = createLegalTextsRequestContextHandlers(deps);

    const response = await handlers.withAuthenticatedLegalTextsHandler(
      new Request('https://example.org/legal-texts', { headers: { 'x-request-id': 'req-1' } }),
      async (_request, ctx) => new Response(ctx.userId, { status: 200 })
    );

    await expect(response.text()).resolves.toBe('u-1');
    expect(deps.withAuthenticatedUser).toHaveBeenCalledTimes(1);
  });

  it('maps unexpected authenticated handler failures to structured 500 responses', async () => {
    const deps: LegalTextsRequestContextDeps<TestContext> = {
      withAuthenticatedUser: vi.fn(async () => {
        throw new Error('boom');
      }),
      logError: vi.fn(),
    };
    const handlers = createLegalTextsRequestContextHandlers(deps);

    const response = await handlers.withAuthenticatedLegalTextsHandler(
      new Request('https://example.org/legal-texts', { headers: { 'x-request-id': 'req-2' } }),
      async () => new Response('never')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: 'internal_error', requestId: 'req-2' });
    expect(deps.logError).toHaveBeenCalledWith(
      'IAM legal texts request failed unexpectedly',
      expect.objectContaining({
        operation: 'iam_legal_texts_request',
        request_id: 'req-2',
        error_message: 'boom',
      })
    );
  });

  it('resolves legal text admin actors after feature, role and membership checks', async () => {
    await withLegalTextsRequestContext(
      new Request('https://example.org/legal-texts', { headers: { 'x-request-id': 'req-3' } }),
      async () => {
        const deps: LegalTextsAdminActorResolverDeps<TestContext> = {
          ensureFeature: vi.fn(() => undefined),
          requireAdminRoles: vi.fn(() => undefined),
          resolveActorInfo: vi.fn(async () => ({
            actor: {
              instanceId: 'de-musterhausen',
              actorAccountId: 'account-1',
              requestId: 'req-3',
              traceId: 'trace-3',
            },
          })),
          createApiError: vi.fn((status, code) => new Response(code, { status })),
        };
        const resolveActor = createLegalTextsAdminActorResolver(deps);

        await expect(resolveActor(new Request('https://example.org/legal-texts'), { userId: 'u-1' })).resolves.toEqual({
          actor: {
            instanceId: 'de-musterhausen',
            actorAccountId: 'account-1',
            requestId: 'req-3',
            traceId: 'trace-3',
          },
        });
        expect(deps.ensureFeature).toHaveBeenCalledWith('req-3');
        expect(deps.requireAdminRoles).toHaveBeenCalledWith({ userId: 'u-1' }, 'req-3');
      }
    );
  });

  it('requires actor account ids for write actors when requested', async () => {
    await withLegalTextsRequestContext(
      new Request('https://example.org/legal-texts', { headers: { 'x-request-id': 'req-4' } }),
      async () => {
        const deps: LegalTextsAdminActorResolverDeps<TestContext> = {
          ensureFeature: vi.fn(() => undefined),
          requireAdminRoles: vi.fn(() => undefined),
          resolveActorInfo: vi.fn(async () => ({ actor: { instanceId: 'de-musterhausen', requestId: 'req-4' } })),
          createApiError: vi.fn((status, code) => new Response(code, { status })),
        };
        const resolveActor = createLegalTextsAdminActorResolver(deps);

        const result = await resolveActor(new Request('https://example.org/legal-texts'), { userId: 'u-1' }, {
          requireActorAccountId: true,
        });

        expect('error' in result ? result.error.status : undefined).toBe(403);
        expect(deps.createApiError).toHaveBeenCalledWith(
          403,
          'forbidden',
          'Akteur-Account nicht gefunden.',
          'req-4'
        );
      }
    );
  });
});
