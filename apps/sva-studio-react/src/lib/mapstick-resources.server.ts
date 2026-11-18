import { mapstickResourcePath, mapstickStyleIds } from '@sva/plugin-sdk';
import { createClientError, createErrorResponse } from './map-geocoding-api.shared.js';
import { withGeocodingOperation } from './map-geocoding-api.operations.js';

const MAX_BYTES = 8 * 1024 * 1024;
const styleNames = mapstickStyleIds.join('|');
const stylePath = new RegExp(`^styles/(${styleNames})/style\\.json$`);
const spritePath = new RegExp(`^styles/(${styleNames})/sprite(?:@2x)?\\.(?:json|png)$`);
const glyphPath = /^fonts\/Noto Sans (?:Regular|Bold|Italic)\/\d{1,5}-\d{1,5}\.pbf$/;

const readBoundedBody = async (
  response: Response,
  limit: number
): Promise<Uint8Array<ArrayBuffer>> => {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw createClientError('provider_error');
  }
  const reader = response.body?.getReader();
  if (!reader) throw createClientError('provider_error');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) throw createClientError('provider_error');
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const completeMapStyle = (body: Uint8Array, origin: string, style: string): string => {
  const document = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
  if (document.version !== 8 || !Array.isArray(document.layers))
    throw createClientError('provider_error');
  const resource = `${origin}${mapstickResourcePath}`;
  const layers = document.layers.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw createClientError('provider_error');
    const layer = entry as Record<string, unknown>;
    const layout = layer.layout as Record<string, unknown> | undefined;
    if (!layout?.['text-font']) return layer;
    const fonts = JSON.stringify(layout['text-font']);
    return {
      ...layer,
      layout: {
        ...layout,
        'text-font': [
          fonts.includes('Bold')
            ? 'Noto Sans Bold'
            : fonts.includes('Italic')
              ? 'Noto Sans Italic'
              : 'Noto Sans Regular',
        ],
      },
    };
  });
  const needsSprite =
    Boolean(document.sprite) ||
    layers.some((layer) => {
      const layout = layer.layout as Record<string, unknown> | undefined;
      const paint = layer.paint as Record<string, unknown> | undefined;
      return (
        Boolean(layout?.['icon-image']) ||
        Object.keys(paint ?? {}).some((key) => key.endsWith('-pattern'))
      );
    });
  return JSON.stringify({
    ...document,
    layers,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: `pmtiles://${resource}/data/region.pmtiles`,
        attribution: '© OpenStreetMap contributors',
      },
    },
    glyphs: `${resource}/fonts/{fontstack}/{range}.pbf`,
    ...(needsSprite ? { sprite: `${resource}/styles/${style}/sprite` } : {}),
  });
};

/** Fixed resource grammar: this is not a general-purpose URL proxy. */
export const getMapstickResourceHandler = async (request: Request): Promise<Response> => {
  if (request.method !== 'GET')
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  try {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname.slice(mapstickResourcePath.length + 1));
    const style = stylePath.exec(path)?.[1];
    const archive = path === 'data/region.pmtiles';
    if (!style && !archive && !spritePath.test(path) && !glyphPath.test(path))
      return new Response(null, { status: 404 });
    const configuredStyle = await withGeocodingOperation(
      request,
      'get_config',
      async (_ctx, config) => {
        if (config.provider !== 'mapstick') throw createClientError('disabled');
        return config.styleUrl;
      }
    );
    const serviceBase = new URL('../../', configuredStyle);
    const target = new URL(path, serviceBase);
    const headers = new Headers();
    let expectedBytes: number | undefined;
    if (archive) {
      const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.get('range') ?? '');
      const start = Number(range?.[1]);
      const end = Number(range?.[2]);
      if (
        !range ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        end < start ||
        end - start + 1 > MAX_BYTES
      )
        return new Response(null, { status: 416 });
      expectedBytes = end - start + 1;
      headers.set('Range', `bytes=${start}-${end}`);
    }
    const { fetchPublicHttps } = await import('@sva/server-runtime');
    const upstream = await fetchPublicHttps(target, {
      headers,
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if (!upstream.ok || (archive && upstream.status !== 206)) {
      await upstream.body?.cancel();
      throw createClientError('provider_error');
    }
    const body = await readBoundedBody(upstream, expectedBytes ?? MAX_BYTES);
    if (archive) {
      const returnedRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        upstream.headers.get('content-range') ?? ''
      );
      if (
        !returnedRange ||
        `bytes=${returnedRange[1]}-${returnedRange[2]}` !== headers.get('Range') ||
        Number(returnedRange[3]) <= Number(returnedRange[2]) ||
        body.length !== expectedBytes
      )
        throw createClientError('provider_error');
    }
    const resultHeaders = new Headers({
      'Content-Type':
        style || path.endsWith('.json')
          ? 'application/json'
          : path.endsWith('.png')
            ? 'image/png'
            : 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      Vary: 'Cookie',
      'X-Content-Type-Options': 'nosniff',
    });
    for (const key of ['etag', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(key);
      if (value && !style) resultHeaders.set(key, value);
    }
    const origin = style
      ? (await import('@sva/auth-runtime/server')).buildRequestOriginFromHeaders(request)
      : url.origin;
    return new Response(style ? completeMapStyle(body, origin, style) : body, {
      status: archive ? 206 : 200,
      headers: resultHeaders,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
};
