import { expect, it, vi } from 'vitest';
import { createPluginServerHandlers } from '../src/server/index.js';
const ctx = {
  scope: 'tenant' as const,
  sessionId: 'session',
  pluginId: 'ssf',
  handlerId: 'ssf.organisation-keys.prepare',
  actor: { id: 'user', instanceId: 'tenant', roles: [] },
  pathParams: {},
};
it('rejects secrets and tenant overrides before invoking the session capability', async () => {
  const handler = createPluginServerHandlers()[ctx.handlerId];
  expect(handler).toBeTypeOf('function');
  const forwardSsfRecordingRequest = vi.fn();
  for (const body of [
    { privateKeyPkcs8: 'secret' },
    { publicKey: 'A'.repeat(87), expectedActiveKeyId: null, tenantId: 'other' },
  ]) {
    const response = await handler!({
      ...ctx,
      request: new Request('https://studio.test/api', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      forwardSsfRecordingRequest,
    });
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain('secret');
  }
  expect(forwardSsfRecordingRequest).not.toHaveBeenCalled();
});
it('redacts malformed gateway output and makes the public response uncacheable', async () => {
  const handler = createPluginServerHandlers()['ssf.organisation-keys.read'];
  expect(handler).toBeTypeOf('function');
  const call = (value: unknown) =>
    handler!({
      ...ctx,
      handlerId: 'ssf.organisation-keys.read',
      request: new Request('https://studio.test/api'),
      forwardSsfRecordingRequest: async () => Response.json(value),
    });
  const failed = await call({ privateKeyPkcs8: 'secret' });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('secret');
  const ok = await call({ keys: [], activeKeyId: null });
  expect(ok.status).toBe(200);
  expect(ok.headers.get('cache-control')).toBe('no-store');
});

it('retains an upstream authentication failure without disclosing provider details', async () => {
  const handler = createPluginServerHandlers()['ssf.organisation-keys.read'];
  const response = await handler!({
    ...ctx,
    handlerId: 'ssf.organisation-keys.read',
    request: new Request('https://studio.test/api'),
    forwardSsfRecordingRequest: async () => new Response('private upstream error', { status: 401 }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED' } });
});
