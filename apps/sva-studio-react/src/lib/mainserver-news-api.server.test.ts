import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  getSvaMainserverNews: vi.fn(),
  createSvaMainserverNews: vi.fn(),
  updateSvaMainserverNews: vi.fn(),
  deleteSvaMainserverNews: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
}));

vi.mock('@sva/sva-mainserver/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/sva-mainserver/server')>();
  return {
    ...actual,
    listSvaMainserverNews: state.listSvaMainserverNews,
    getSvaMainserverNews: state.getSvaMainserverNews,
    createSvaMainserverNews: state.createSvaMainserverNews,
    updateSvaMainserverNews: state.updateSvaMainserverNews,
    deleteSvaMainserverNews: state.deleteSvaMainserverNews,
  };
});

import { dispatchMainserverNewsRequest } from './mainserver-news-api.server';
import { SvaMainserverError } from '@sva/sva-mainserver/server';

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'subject-1',
    email: 'editor@example.invalid',
    displayName: 'Editor',
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
};

const newsInput = {
  title: 'Neue News',
  publishedAt: '2026-04-14T09:30:00.000Z',
  payload: {
    teaser: 'Kurztext',
    body: '<p>Body</p>',
    category: 'Allgemein',
  },
};

describe('dispatchMainserverNewsRequest', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ignores unrelated routes', async () => {
    await expect(dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/iam/contents'))).resolves.toBeNull();
  });

  it('lists news after content read authorization', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockResolvedValue([{ id: 'news-1' }]);

    const response = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.read' })
    );
    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
    });
    await expect(response?.json()).resolves.toEqual({ data: [{ id: 'news-1' }] });
  });

  it('creates published news and rejects missing publishedAt before GraphQL', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.createSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const ok = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        body: JSON.stringify(newsInput),
      })
    );
    await expect(ok?.json()).resolves.toEqual({ data: { id: 'news-1' } });
    expect(ok?.status).toBe(201);

    const rejected = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news', {
        method: 'POST',
        body: JSON.stringify({ ...newsInput, publishedAt: '' }),
      })
    );
    expect(rejected?.status).toBe(400);
    expect(state.createSvaMainserverNews).toHaveBeenCalledTimes(1);
  });

  it('requires metadata and payload permissions before updating news', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.updateSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const response = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        body: JSON.stringify(newsInput),
      })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'content.updateMetadata' })
    );
    expect(state.authorizeContentPrimitiveForUser).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'content.updatePayload' })
    );
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
  });

  it('deletes news via mainserver hard delete', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.deleteSvaMainserverNews.mockResolvedValue({ id: 'news-1' });

    const response = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news/news-1', { method: 'DELETE' })
    );

    expect(state.authorizeContentPrimitiveForUser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'content.delete' })
    );
    expect(state.deleteSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      newsId: 'news-1',
    });
    await expect(response?.json()).resolves.toEqual({ data: { id: 'news-1' } });
  });

  it('maps local authorization and upstream errors to stable error responses', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung.',
    });

    const denied = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toEqual({ error: 'forbidden', message: 'Keine Berechtigung.' });

    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverNews.mockRejectedValueOnce(
      new SvaMainserverError({ code: 'missing_credentials', message: 'Credentials fehlen.', statusCode: 400 })
    );

    const upstream = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(upstream?.status).toBe(400);
    await expect(upstream?.json()).resolves.toEqual({ error: 'missing_credentials', message: 'Credentials fehlen.' });
  });

  it('returns stable errors for missing instance context and unsupported methods', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const missingInstance = await dispatchMainserverNewsRequest(new Request('https://studio.test/api/v1/mainserver/news'));
    expect(missingInstance?.status).toBe(400);
    await expect(missingInstance?.json()).resolves.toEqual({
      error: 'missing_instance',
      message: 'Kein Instanzkontext.',
    });

    const unsupported = await dispatchMainserverNewsRequest(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'PUT' })
    );
    expect(unsupported?.status).toBe(405);
    await expect(unsupported?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'Methode wird für Mainserver-News nicht unterstützt.',
    });
  });
});
