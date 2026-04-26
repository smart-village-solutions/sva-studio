import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isUuid, readBoolean, readNumber, readObject, readString } from './input-readers.js';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readInstanceIdFromRequest,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './request-helpers.js';

describe('shared request helpers', () => {
  it('reads primitive input values defensively', () => {
    expect(readString(' value ')).toBe('value');
    expect(readString('   ')).toBeUndefined();
    expect(readString(1)).toBeUndefined();
    expect(readNumber(3)).toBe(3);
    expect(readNumber(Number.NaN)).toBeUndefined();
    expect(readNumber('3')).toBeUndefined();
    expect(readBoolean(false)).toBe(false);
    expect(readBoolean('false')).toBeUndefined();
    expect(readObject({ id: '1' })).toEqual({ id: '1' });
    expect(readObject([])).toBeUndefined();
    expect(readObject(null)).toBeUndefined();
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('builds response envelopes and parses request bodies', async () => {
    const error = createApiError(400, 'invalid_request', 'Ungültig.', 'request-1', { field: 'title' });
    await expect(error.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'Ungültig.',
        details: { field: 'title' },
      },
      requestId: 'request-1',
    });
    expect(error.headers.get('x-request-id')).toBe('request-1');

    expect(asApiItem({ id: '1' }, 'request-1')).toEqual({ data: { id: '1' }, requestId: 'request-1' });
    expect(asApiList([{ id: '1' }], { page: 1, pageSize: 25, total: 1 })).toEqual({
      data: [{ id: '1' }],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });

    const schema = z.object({ title: z.string().min(1) });
    await expect(parseRequestBody(new Request('https://example.test', { method: 'POST', body: '{"title":"News"}' }), schema))
      .resolves.toEqual({
        ok: true,
        data: { title: 'News' },
        rawBody: '{"title":"News"}',
      });
    await expect(parseRequestBody(new Request('https://example.test', { method: 'POST', body: '{' }), schema))
      .resolves.toMatchObject({ ok: false, message: 'JSON-Body ist ungültig.' });
    await expect(parseRequestBody(new Request('https://example.test', { method: 'POST', body: '{}' }), schema))
      .resolves.toMatchObject({ ok: false, message: expect.stringContaining('title:') });
  });

  it('reads pagination, path, instance and idempotency values', async () => {
    const request = new Request('https://example.test/api/v1/items/item-1?page=-1&pageSize=200&instanceId= instance-1 ');
    expect(readPage(request)).toEqual({ page: 1, pageSize: 100 });
    expect(readInstanceIdFromRequest(request, 'fallback')).toBe('instance-1');
    expect(readInstanceIdFromRequest(new Request('https://example.test/api'), 'fallback')).toBe('fallback');
    expect(readPathSegment(request, 2)).toBe('items');
    expect(readPathSegment(request, 10)).toBeUndefined();
    expect(toPayloadHash('body')).toHaveLength(64);

    expect(requireIdempotencyKey(new Request('https://example.test', { headers: { 'Idempotency-Key': ' key-1 ' } })))
      .toEqual({ key: 'key-1' });
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
