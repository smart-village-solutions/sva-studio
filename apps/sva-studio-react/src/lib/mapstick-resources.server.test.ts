import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn(), authorize: vi.fn() }));
vi.mock('@sva/auth-runtime/server', () => ({
  buildRequestOriginFromHeaders: (request: Request) =>
    request.headers.get('x-test-public-origin') ?? new URL(request.url).origin,
}));
vi.mock('@sva/server-runtime', () => ({ fetchPublicHttps: state.fetch }));
vi.mock('./map-geocoding-api.operations.js', () => ({ withGeocodingOperation: state.authorize }));
import { getMapstickResourceHandler } from './mapstick-resources.server.js';
const path = '/api/v1/iam/map-geocoding/mapstick/';
const request = (resource: string, headers?: HeadersInit) =>
  new Request(`https://studio.example${path}${resource}`, { headers });
beforeEach(() => {
  vi.clearAllMocks();
  state.authorize.mockImplementation(async (_req, _operation, run) =>
    run(
      {},
      {
        provider: 'mapstick',
        styleUrl: 'https://maps.example/region/styles/osm-bright/style.json',
      }
    )
  );
});
describe('Mapstick resources', () => {
  it('completes the style with same-origin PMTiles, glyphs and sprites', async () => {
    state.fetch.mockResolvedValue(
      Response.json({
        version: 8,
        layers: [
          {
            id: 'labels',
            type: 'symbol',
            source: 'openmaptiles',
            layout: { 'text-font': ['External Bold'], 'icon-image': 'park' },
          },
        ],
        glyphs: 'https://external.example/fonts',
      })
    );
    const result = await getMapstickResourceHandler(request('styles/osm-bright/style.json'));
    expect(result.status).toBe(200);
    const style = await result.json();
    expect(style.sources.openmaptiles.url).toBe(
      `pmtiles://https://studio.example${path}data/region.pmtiles`
    );
    expect(style.glyphs).toBe(`https://studio.example${path}fonts/{fontstack}/{range}.pbf`);
    expect(style.layers[0].layout['text-font']).toEqual(['Noto Sans Bold']);
    expect(style.sprite).toBe(`https://studio.example${path}styles/osm-bright/sprite`);
    expect(String(state.fetch.mock.calls[0]?.[0])).toBe(
      'https://maps.example/region/styles/osm-bright/style.json'
    );
  });
  it('uses the existing public-origin resolver for styles behind a TLS proxy', async () => {
    state.fetch.mockResolvedValue(Response.json({ version: 8, layers: [] }));
    const result = await getMapstickResourceHandler(
      request('styles/osm-bright/style.json', {
        'x-test-public-origin': 'https://public-studio.example',
      })
    );
    const style = await result.json();
    expect(style.sources.openmaptiles.url).toContain('pmtiles://https://public-studio.example/');
  });
  it('rejects mismatching Content-Range responses', async () => {
    state.fetch.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: { 'Content-Range': 'bytes 4-6/100' },
      })
    );
    expect(
      (await getMapstickResourceHandler(request('data/region.pmtiles', { Range: 'bytes=0-2' })))
        .status
    ).toBe(400);
  });

  it('forwards bounded archive ranges and preserves range metadata', async () => {
    state.fetch.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: { 'Content-Range': 'bytes 0-2/100', ETag: 'v1' },
      })
    );
    const result = await getMapstickResourceHandler(
      request('data/region.pmtiles', { Range: 'bytes=0-2' })
    );
    expect(result.status).toBe(206);
    expect(result.headers.get('content-range')).toBe('bytes 0-2/100');
    expect(result.headers.get('etag')).toBe('v1');
    expect(result.headers.get('cache-control')).toContain('private');
    expect(state.fetch.mock.calls[0]?.[1].headers.get('Range')).toBe('bytes=0-2');
    expect(state.fetch.mock.calls[0]?.[1].redirect).toBe('error');
  });
  it.each(['', 'bytes=0-', 'bytes=4-2', 'bytes=0-9000000', 'bytes=0-2,8-9'])(
    'rejects invalid archive range %s',
    async (Range) => {
      expect(
        (await getMapstickResourceHandler(request('data/region.pmtiles', { Range }))).status
      ).toBe(416);
      expect(state.fetch).not.toHaveBeenCalled();
    }
  );
  it.each([
    'proxy/?url=https://evil.example',
    'styles/unknown/style.json',
    'fonts/../../config.json',
    'https://evil.example',
    'config.json',
  ])('rejects arbitrary resources %s', async (resource) => {
    expect((await getMapstickResourceHandler(request(resource))).status).toBe(404);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('does not fetch when authorization fails', async () => {
    state.authorize.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { code: 'unauthorized' })
    );
    expect((await getMapstickResourceHandler(request('styles/osm-bright/style.json'))).status).toBe(
      401
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('rejects full archive responses and oversized chunked bodies', async () => {
    state.fetch.mockResolvedValue(new Response('full archive'));
    expect(
      (await getMapstickResourceHandler(request('data/region.pmtiles', { Range: 'bytes=0-2' })))
        .status
    ).toBe(400);
    state.fetch.mockResolvedValue(new Response(new Uint8Array(8 * 1024 * 1024 + 1)));
    expect((await getMapstickResourceHandler(request('styles/osm-bright/sprite.png'))).status).toBe(
      400
    );
  });
});


it.each([
  'http://maps.example/styles/osm-bright/style.json',
  'https://user:password@maps.example/styles/osm-bright/style.json',
  'https://maps.example/styles/osm-bright/style.json?token=secret',
  'https://maps.example/styles/osm-bright/style.json#fragment',
  'https://maps.example/arbitrary/path/style.json',
  'not-a-url',
])('rejects noncanonical stored Mapstick style %s before fetching', async (styleUrl) => {
  state.authorize.mockImplementation(async (_req, _operation, run) =>
    run({}, { provider: 'mapstick', styleUrl })
  );
  const result = await getMapstickResourceHandler(request('styles/osm-bright/style.json'));
  expect(result.status).toBe(400);
  expect(state.fetch).not.toHaveBeenCalled();
});
