import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  load: vi.fn(),
  log: vi.fn(),
  withAuthenticatedUser: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({ withAuthenticatedUser: state.withAuthenticatedUser }));
vi.mock('./user-documentation.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./user-documentation.server')>()),
  loadUserDocumentation: state.load,
  logUserDocumentationError: state.log,
}));

import { dispatchUserDocumentationRequest } from './user-documentation-api.server';

describe('user-documentation-api.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) => handler({}));
  });

  it('returns the current markdown and supports conditional responses', async () => {
    state.load.mockResolvedValue({
      id: 'home.overview',
      markdown: '# Start',
      websiteUrl: 'https://docs.example.test/pages/home.overview/',
      etag: '"v1"',
    });
    const response = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/home.overview')
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toBe('private, max-age=60');

    const unchanged = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/home.overview', {
        headers: { 'if-none-match': '"v1"' },
      })
    );
    expect(unchanged?.status).toBe(304);
  });

  it('rejects unsupported methods and malformed page paths', async () => {
    expect(
      (
        await dispatchUserDocumentationRequest(
          new Request('https://studio.test/api/studio/documentation/home.overview', {
            method: 'POST',
          })
        )
      )?.status
    ).toBe(405);
    expect(
      (
        await dispatchUserDocumentationRequest(
          new Request('https://studio.test/api/studio/documentation/home/overview')
        )
      )?.status
    ).toBe(404);
  });

  it('maps controlled upstream errors without exposing details', async () => {
    const { UserDocumentationError } = await import('./user-documentation.server');
    state.load.mockRejectedValue(
      new UserDocumentationError('documentation_not_configured', 503)
    );
    const response = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/home.overview')
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ error: 'documentation_not_configured' });
    expect(state.log).toHaveBeenCalledWith(
      'home.overview',
      expect.objectContaining({ code: 'documentation_not_configured' })
    );
  });

  it('ignores unrelated routes and rejects invalid percent encoding', async () => {
    await expect(
      dispatchUserDocumentationRequest(new Request('https://studio.test/api/other'))
    ).resolves.toBeNull();

    const response = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/%E0%A4%A')
    );
    expect(response?.status).toBe(404);
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('returns payloads without etags and maps unexpected errors to a controlled response', async () => {
    state.load.mockResolvedValueOnce({
      id: 'home.overview',
      markdown: '# Start',
      websiteUrl: 'https://docs.example.test/pages/home.overview/',
    });
    const success = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/home.overview')
    );
    expect(success?.status).toBe(200);
    expect(success?.headers.get('etag')).toBeNull();

    state.load.mockRejectedValueOnce(new Error('upstream failed'));
    const failure = await dispatchUserDocumentationRequest(
      new Request('https://studio.test/api/studio/documentation/home.overview')
    );
    expect(failure?.status).toBe(502);
    await expect(failure?.json()).resolves.toEqual({
      error: 'documentation_upstream_unavailable',
    });
  });
});
