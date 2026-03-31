import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  parseRequestBody,
  readInstanceIdFromRequest,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
} from './request-helpers.js';

describe('shared/request-helpers', () => {
  it('parses valid request bodies against the schema', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Studio' }),
    });

    await expect(parseRequestBody(request, z.object({ name: z.string() }))).resolves.toEqual({
      ok: true,
      data: { name: 'Studio' },
      rawBody: '{"name":"Studio"}',
    });
  });

  it('returns a readable validation error for invalid bodies', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    await expect(parseRequestBody(request, z.object({ name: z.string() }))).resolves.toEqual({
      ok: false,
      rawBody: '{}',
      message: 'name: Invalid input: expected string, received undefined',
    });
  });

  it('reads page data and clamps page size', () => {
    const request = new Request('http://localhost/test?page=2&pageSize=999');
    expect(readPage(request)).toEqual({ page: 2, pageSize: 100 });
  });

  it('reads path segments and request instance ids', () => {
    const request = new Request('http://localhost/api/v1/items/123?instanceId=de-musterhausen');
    expect(readPathSegment(request, 3)).toBe('123');
    expect(readInstanceIdFromRequest(request)).toBe('de-musterhausen');
  });

  it('requires an idempotency key header', () => {
    const missing = new Request('http://localhost/test', { method: 'POST' });
    const present = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'idempotency-key': 'idem-1' },
    });

    expect(requireIdempotencyKey(missing)).toEqual({
      error: expect.any(Response),
    });
    expect(requireIdempotencyKey(present)).toEqual({ key: 'idem-1' });
  });
});
