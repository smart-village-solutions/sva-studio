import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadStudioChangelogEntries: vi.fn(),
  withAuthenticatedUser: vi.fn(),
}));

vi.mock('./studio-changelog.server', () => ({
  loadStudioChangelogEntries: state.loadStudioChangelogEntries,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

import { dispatchStudioChangelogRequest } from './studio-changelog-api.server';

describe('studio-changelog-api.server', () => {
  it('returns the changelog payload for GET requests', async () => {
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) => handler({}));
    state.loadStudioChangelogEntries.mockResolvedValue([
      {
        prNumber: 412,
        body: 'Allgemeine Verbesserungen',
      },
    ]);

    const response = await dispatchStudioChangelogRequest(
      new Request('https://studio.test/api/studio/changelog', { method: 'GET' })
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      entries: [
        {
          prNumber: 412,
          body: 'Allgemeine Verbesserungen',
        },
      ],
    });
  });

  it('returns method not allowed for unsupported methods', async () => {
    const response = await dispatchStudioChangelogRequest(
      new Request('https://studio.test/api/studio/changelog', { method: 'POST' })
    );

    expect(response?.status).toBe(405);
  });

  it('returns a controlled error response when loading fails', async () => {
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) => handler({}));
    state.loadStudioChangelogEntries.mockRejectedValue(new Error('kaputt'));

    const response = await dispatchStudioChangelogRequest(
      new Request('https://studio.test/api/studio/changelog', { method: 'GET' })
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: 'studio_changelog_unavailable',
      message: 'Studio-Changelog konnte nicht geladen werden.',
    });
  });

  it('returns null for unrelated paths', async () => {
    await expect(
      dispatchStudioChangelogRequest(new Request('https://studio.test/api/studio/unknown', { method: 'GET' }))
    ).resolves.toBeNull();
  });

  it('returns the auth middleware response for unauthenticated requests', async () => {
    state.withAuthenticatedUser.mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    );

    const response = await dispatchStudioChangelogRequest(
      new Request('https://studio.test/api/studio/changelog', { method: 'GET' })
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: 'unauthorized' });
  });
});
