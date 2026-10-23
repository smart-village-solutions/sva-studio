import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HttpResponse, http, studioMswServer } from 'tooling-testing/msw';
import { requestCatalogDownload } from './catalog.api.js';
const scope = {
  kind: 'municipal' as const,
  instanceId: 'town',
  organizationId: '11111111-1111-4111-8111-111111111111',
};
beforeAll(() => studioMswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => studioMswServer.resetHandlers());
afterAll(() => studioMswServer.close());
describe('snapshot download transport', () => {
  it('binds the authenticated GET to the historical release, organization and page mode', async () => {
    let received: Request | undefined;
    studioMswServer.use(
      http.get('*/api/v1/iam/app-translations', ({ request }) => {
        received = request;
        return new HttpResponse('export let texts = {};', {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
        });
      })
    );
    expect(
      await (
        await requestCatalogDownload('saved', scope, new AbortController().signal, 'source')
      ).text()
    ).toBe('export let texts = {};');
    expect(received).toBeDefined();
    expect(new URL(received!.url).searchParams.get('operation')).toBe('downloadTexts');
    expect(new URL(received!.url).searchParams.get('releaseId')).toBe('saved');
    expect(received!.method).toBe('GET');
    expect(received!.credentials).toBe('same-origin');
    expect(received!.redirect).toBe('error');
    expect(received!.headers.get('X-SVA-Catalog-Scope')).toBe(JSON.stringify(scope));
    expect(received!.headers.get('X-SVA-Catalog-Mode')).toBe('source');
  });
  it.each([
    () => new HttpResponse('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
    () =>
      new HttpResponse('too large', {
        headers: { 'Content-Type': 'text/javascript', 'Content-Length': String(9 * 1024 * 1024) },
      }),
    () =>
      new HttpResponse('x'.repeat(8 * 1024 * 1024 + 1), {
        headers: { 'Content-Type': 'text/javascript' },
      }),
    () => HttpResponse.json({ error: 'catalog_forbidden' }, { status: 403 }),
    () => new HttpResponse('offline', { status: 503 }),
  ])(
    'rejects invalid or failed responses without returning a partial download',
    async (response) => {
      studioMswServer.use(http.get('*/api/v1/iam/app-translations', () => response()));
      await expect(
        requestCatalogDownload('saved', scope, new AbortController().signal, 'translations')
      ).rejects.toThrow();
    }
  );
});
