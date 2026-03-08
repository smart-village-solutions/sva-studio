import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';

import { createDataClient } from '../index';

describe('createDataClient.get', () => {
  it('validates payload with zod schema', async () => {
    const client = createDataClient({ baseUrl: 'https://example.invalid' });
    const schema = z.object({ ok: z.boolean() });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      const payload = await client.get('/health', schema);
      assert.deepEqual(payload, { ok: false });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when schema validation fails', async () => {
    const client = createDataClient({ baseUrl: 'https://example.invalid' });
    const schema = z.object({ ok: z.boolean() });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: 'nope' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      await assert.rejects(() => client.get('/health-invalid', schema));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
