/** Release feed boundaries, per-request authentication and shared public cache. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ auth: vi.fn(), warn: vi.fn() }));
vi.mock('@sva/auth-runtime/server', () => ({ withAuthenticatedUser: state.auth }));
vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => ({ warn: state.warn }) }));
const release = (tag = 'studio-v1.4.0', extra = {}) => ({
  tag_name: tag,
  name: 'Studio 1.4',
  published_at: '2026-11-13T17:57:57Z',
  body: '# Improved\n\nRelease notes',
  draft: false,
  prerelease: false,
  ...extra,
});
const request = () => new Request('https://studio.test/api/studio/releases');

describe('Studio release feed', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.auth.mockImplementation(async (_request, handler) => handler({}));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('filters other products, drafts and prereleases, sorts newest first and bounds the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          release('studio-v1.3.0', { published_at: '2026-11-09T22:52:05Z', name: null }),
          release(),
          release('ssf-v1.0.0'),
          release('studio-v2.0.0', { draft: true }),
          release('studio-v2.0.0-beta.1', { prerelease: true }),
        ])
      );
    vi.stubGlobal('fetch', fetchMock);
    const { dispatchStudioReleaseNotesRequest } = await import('./studio-release-notes.server');
    const response = await dispatchStudioReleaseNotesRequest(request());
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual([
      {
        tag: 'studio-v1.4.0',
        name: 'Studio 1.4',
        publishedAt: '2026-11-13T17:57:57Z',
        body: '# Improved\n\nRelease notes',
      },
      {
        tag: 'studio-v1.3.0',
        name: 'studio-v1.3.0',
        publishedAt: '2026-11-09T22:52:05Z',
        body: '# Improved\n\nRelease notes',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/smart-village-solutions/sva-studio/releases?per_page=100',
      expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) })
    );
  });

  it('shares in-flight and cached public data but authenticates every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([release()]));
    vi.stubGlobal('fetch', fetchMock);
    const { dispatchStudioReleaseNotesRequest } = await import('./studio-release-notes.server');
    await Promise.all([
      dispatchStudioReleaseNotesRequest(request()),
      dispatchStudioReleaseNotesRequest(request()),
    ]);
    await dispatchStudioReleaseNotesRequest(request());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.auth).toHaveBeenCalledTimes(3);
    state.auth.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await dispatchStudioReleaseNotesRequest(request()))?.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expires its cache and returns at most twenty releases', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        Response.json(Array.from({ length: 30 }, (_, i) => release(`studio-v1.0.${i}`)))
      );
    vi.stubGlobal('fetch', fetchMock);
    const { loadStudioReleaseNotes } = await import('./studio-release-notes.server');
    expect(await loadStudioReleaseNotes()).toHaveLength(20);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await loadStudioReleaseNotes();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    () => Response.json({ message: 'private upstream details' }, { status: 403 }),
    () => Response.json([{ broken: true }]),
    () => new Response('not JSON', { headers: { 'content-type': 'text/plain' } }),
    () => Response.json([release()], { headers: { 'content-length': String(3 * 1024 * 1024) } }),
    () => Response.json([release('studio-v1.4.0', { body: 'x'.repeat(3 * 1024 * 1024) })]),
  ])(
    'fails closed on invalid or oversized upstream data without exposing details',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
      const { dispatchStudioReleaseNotesRequest } = await import('./studio-release-notes.server');
      const result = await dispatchStudioReleaseNotesRequest(request());
      expect(result?.status).toBe(502);
      expect(await result?.json()).toEqual({ error: 'release_notes_unavailable' });
      expect(state.warn).toHaveBeenCalledWith(expect.any(String), {
        operation: 'load_release_notes',
        error_type: 'upstream_unavailable',
      });
    }
  );

  it('aborts timed-out upstream requests and allows a subsequent retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Timeout', 'AbortError'))
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { dispatchStudioReleaseNotesRequest } = await import('./studio-release-notes.server');
    const pending = dispatchStudioReleaseNotesRequest(request());
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await pending)?.status).toBe(502);
    fetchMock.mockResolvedValueOnce(Response.json([]));
    expect((await dispatchStudioReleaseNotesRequest(request()))?.status).toBe(200);
  });

  it('ignores unrelated paths and rejects mutations', async () => {
    const { dispatchStudioReleaseNotesRequest } = await import('./studio-release-notes.server');
    expect(
      await dispatchStudioReleaseNotesRequest(new Request('https://studio.test/other'))
    ).toBeNull();
    expect(
      (await dispatchStudioReleaseNotesRequest(new Request(request(), { method: 'POST' })))?.status
    ).toBe(405);
    expect(state.auth).not.toHaveBeenCalled();
  });
});
