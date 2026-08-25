import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerWarn = vi.hoisted(() => vi.fn());
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: loggerWarn }),
}));

import {
  loadUserDocumentation,
  logUserDocumentationError,
  UserDocumentationError,
} from './user-documentation.server';

const manifest = (page: object) =>
  new Response(JSON.stringify({ schemaVersion: 1, pages: { 'home.overview': page } }), {
    headers: { 'content-type': 'application/json' },
  });

describe('user-documentation.server', () => {
  beforeEach(() => {
    loggerWarn.mockClear();
  });

  it('loads a known page without forwarding Studio request context', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        manifest({ markdownPath: 'markdown/home.overview.md', websiteUrl: 'pages/home.overview/' })
      )
      .mockResolvedValueOnce(
        new Response('# Startseite', {
          headers: { 'content-type': 'text/markdown', etag: '"markdown-1"' },
        })
      );

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/studio/',
        fetch: request,
      })
    ).resolves.toEqual({
      id: 'home.overview',
      markdown: '# Startseite',
      websiteUrl: 'https://docs.example.test/studio/pages/home.overview/',
      etag: '"markdown-1"',
    });
    expect(request).toHaveBeenNthCalledWith(
      1,
      new URL('https://docs.example.test/studio/manifest.json'),
      expect.objectContaining({ method: 'GET', redirect: 'manual' })
    );
    expect(request.mock.calls[0]?.[1]?.credentials).toBeUndefined();
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({ accept: 'application/json' });
  });

  it('rejects unknown ids before contacting the upstream', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      loadUserDocumentation('unknown.page', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_page_unknown' });
    expect(request).not.toHaveBeenCalled();
  });

  it('fails closed for non-https configuration and cross-origin manifest targets', async () => {
    await expect(
      loadUserDocumentation('home.overview', { baseUrl: 'http://docs.example.test/' })
    ).rejects.toMatchObject({ code: 'documentation_not_configured' });

    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        manifest({
          markdownPath: 'https://attacker.example/page.md',
          websiteUrl: 'pages/home.overview/',
        })
      );
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });
  });

  it('rejects oversized and incorrectly typed responses', async () => {
    const oversized = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('{}', {
        headers: { 'content-type': 'application/json', 'content-length': '9999999' },
      })
    );
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: oversized,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });

    const wrongType = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('{}', { headers: { 'content-type': 'text/html' } })
    );
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: wrongType,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });
  });

  it('maps redirects and timeouts to controlled upstream errors', async () => {
    const redirect = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://docs.example.test/other' } })
    );
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: redirect,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_unavailable' });

    const timeout = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: timeout,
        timeoutMs: 1,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_unavailable' });
  });

  it('rejects missing, malformed and credential-bearing base URLs', async () => {
    await expect(
      loadUserDocumentation('home.overview', { baseUrl: undefined })
    ).rejects.toMatchObject({ code: 'documentation_not_configured' });
    await expect(
      loadUserDocumentation('home.overview', { baseUrl: 'not a url' })
    ).rejects.toMatchObject({ code: 'documentation_not_configured' });
    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://user:secret@docs.example.test/',
      })
    ).rejects.toMatchObject({ code: 'documentation_not_configured' });
  });

  it.each([
    ['not json', 'application/json'],
    [JSON.stringify({ schemaVersion: 2, pages: {} }), 'application/json'],
    [JSON.stringify({ schemaVersion: 1, pages: [] }), 'application/json'],
    [
      JSON.stringify({
        schemaVersion: 1,
        pages: { 'home.overview': { markdownPath: 42, websiteUrl: 'pages/home/' } },
      }),
      'application/json',
    ],
  ])('rejects malformed manifest content', async (body, contentType) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(body, { headers: { 'content-type': contentType } }));

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });
  });

  it('rejects manifests without the requested known page', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ schemaVersion: 1, pages: {} }), {
        headers: { 'content-type': 'application/json' },
      })
    );

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_page_missing' });
  });

  it('rejects markdown whose actual response body exceeds the byte limit', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        manifest({ markdownPath: 'markdown/home.overview.md', websiteUrl: 'pages/home.overview/' })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
          headers: { 'content-type': 'text/markdown' },
        })
      );

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });
  });

  it('cancels an oversized markdown stream before consuming further chunks', async () => {
    let cancelled = false;
    let chunkCount = 0;
    const markdownStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunkCount += 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        manifest({ markdownPath: 'markdown/home.overview.md', websiteUrl: 'pages/home.overview/' })
      )
      .mockResolvedValueOnce(
        new Response(markdownStream, { headers: { 'content-type': 'text/markdown' } })
      );

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).rejects.toMatchObject({ code: 'documentation_upstream_invalid' });
    expect(cancelled).toBe(true);
    expect(chunkCount).toBeLessThanOrEqual(4);
  });

  it('omits an absent markdown etag and emits only structured diagnostics', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        manifest({ markdownPath: 'markdown/home.overview.md', websiteUrl: 'pages/home.overview/' })
      )
      .mockResolvedValueOnce(
        new Response('# Startseite', { headers: { 'content-type': 'text/plain' } })
      );

    await expect(
      loadUserDocumentation('home.overview', {
        baseUrl: 'https://docs.example.test/',
        fetch: request,
      })
    ).resolves.toEqual({
      id: 'home.overview',
      markdown: '# Startseite',
      websiteUrl: 'https://docs.example.test/pages/home.overview/',
    });

    const error = new UserDocumentationError('documentation_upstream_unavailable', 502);
    logUserDocumentationError('home.overview', error);
    expect(loggerWarn).toHaveBeenCalledWith(
      'Anwenderdokumentation konnte nicht geladen werden',
      expect.objectContaining({
        operation: 'user_documentation_load',
        page_id: 'home.overview',
        reason_code: 'documentation_upstream_unavailable',
        http_status: 502,
      })
    );
  });
});
