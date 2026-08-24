import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn() }),
}));

import { loadUserDocumentation } from './user-documentation.server';

const manifest = (page: object) =>
  new Response(JSON.stringify({ schemaVersion: 1, pages: { 'home.overview': page } }), {
    headers: { 'content-type': 'application/json' },
  });

describe('user-documentation.server', () => {
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
});
