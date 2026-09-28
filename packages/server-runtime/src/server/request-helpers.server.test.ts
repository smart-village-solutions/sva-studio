import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  asApiItem,
  asApiList,
  createApiError,
  jsonResponse,
  parseRequestBody,
  readInstanceIdFromRequest,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './request-helpers.server.js';

describe('server request helpers', () => {
  it('builds private response envelopes and parses request bodies', async () => {
    const error = createApiError(400, 'invalid_request', 'Ungültig.', 'request-1', {
      field: 'title',
    });
    await expect(error.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'Ungültig.',
        details: { field: 'title' },
      },
      requestId: 'request-1',
    });
    expect(error.headers.get('x-request-id')).toBe('request-1');
    expect(error.headers.get('cache-control')).toBe('private, no-store');
    expect(error.headers.get('vary')).toBe('Cookie');
    const existingHeaders = jsonResponse(
      200,
      {},
      { Vary: 'Accept, cookie', 'Cache-Control': 'max-age=60' }
    ).headers;
    expect(existingHeaders.get('vary')).toBe('Accept, cookie');
    expect(existingHeaders.get('cache-control')).toBe('max-age=60');
    expect(jsonResponse(200, {}).headers.get('content-type')).toBe('application/json');
    expect(asApiItem({ id: '1' }, 'request-1')).toEqual({
      data: { id: '1' },
      requestId: 'request-1',
    });
    expect(asApiList([{ id: '1' }], { page: 1, pageSize: 25, total: 1 })).toEqual({
      data: [{ id: '1' }],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });

    const schema = z.object({ title: z.string().min(1) });
    await expect(
      parseRequestBody(
        new Request('https://example.test', { method: 'POST', body: '{"title":"News"}' }),
        schema
      )
    ).resolves.toEqual({ ok: true, data: { title: 'News' }, rawBody: '{"title":"News"}' });
    await expect(
      parseRequestBody(new Request('https://example.test', { method: 'POST', body: '{' }), schema)
    ).resolves.toMatchObject({ ok: false, message: 'JSON-Body ist ungültig.' });
    await expect(
      parseRequestBody(new Request('https://example.test', { method: 'POST', body: '{}' }), schema)
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining('title:') });
  });

  it('reads pagination, path, instance and idempotency values', async () => {
    const request = new Request(
      'https://example.test/api/v1/items/item-1?page=-1&pageSize=200&instanceId= instance-1 '
    );
    expect(readPage(request)).toEqual({ page: 1, pageSize: 100 });
    expect(readPage(new Request('https://example.test/api/v1/items/item-1'))).toEqual({
      page: 1,
      pageSize: 25,
    });
    expect(readInstanceIdFromRequest(request, 'fallback')).toBe('instance-1');
    expect(readInstanceIdFromRequest(new Request('https://example.test/api'), 'fallback')).toBe(
      'fallback'
    );
    expect(readPathSegment(request, 2)).toBe('items');
    expect(readPathSegment(new Request('https://example.test/api/v1/items/news%2Fslug'), 3)).toBe(
      'news/slug'
    );
    expect(
      readPathSegment(new Request('https://example.test/api/v1/items/%E0%A4%A'), 3)
    ).toBeUndefined();
    expect(readPathSegment(request, 10)).toBeUndefined();
    expect(toPayloadHash('body')).toHaveLength(64);
    expect(
      requireIdempotencyKey(
        new Request('https://example.test', {
          headers: { 'Idempotency-Key': ' key-1 ' },
        })
      )
    ).toEqual({ key: 'key-1' });
    const missing = requireIdempotencyKey(new Request('https://example.test'), 'request-1');
    expect('error' in missing ? missing.error.status : 0).toBe(400);
    if ('error' in missing) {
      await expect(missing.error.json()).resolves.toMatchObject({
        error: { code: 'idempotency_key_required' },
        requestId: 'request-1',
      });
    }
  });
});
