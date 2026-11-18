import { expect, it, vi } from 'vitest';
import { createPluginServerHandlers } from '../src/server/index.js';
const getHandler = (
  id: string,
  capabilities?: Parameters<typeof createPluginServerHandlers>[0]
) => {
  const handler = createPluginServerHandlers(capabilities)[id];
  if (!handler) throw new Error('Missing test handler ' + id);
  return handler;
};

const ctx = {
  scope: 'tenant' as const,
  sessionId: 'session',
  pluginId: 'ssf',
  handlerId: 'ssf.organisation-keys.prepare',
  actor: { id: 'user', instanceId: 'tenant', roles: [] },
  pathParams: {},
};
it('rejects secrets and tenant overrides before invoking the session capability', async () => {
  const handler = getHandler(ctx.handlerId);
  expect(handler).toBeTypeOf('function');
  const forwardSsfRecordingRequest = vi.fn();
  for (const body of [
    { privateKeyPkcs8: 'secret' },
    { publicKey: 'A'.repeat(87), expectedActiveKeyId: null, tenantId: 'other' },
  ]) {
    const response = await handler({
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
  const handler = getHandler('ssf.organisation-keys.read');
  expect(handler).toBeTypeOf('function');
  const call = (value: unknown) =>
    handler({
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
  const handler = getHandler('ssf.organisation-keys.read');
  const response = await handler({
    ...ctx,
    handlerId: 'ssf.organisation-keys.read',
    request: new Request('https://studio.test/api'),
    forwardSsfRecordingRequest: async () => new Response('private upstream error', { status: 401 }),
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: { code: 'AUTHENTICATION_REQUIRED' } });
});

it.each(['ssf.organisation-keys.prepare', 'ssf.access-transfer.prepare'])(
  'preserves the explicit operator cutover requirement for %s',
  async (handlerId) => {
    const id = '122db777-aeaa-488f-b099-92af0709bc8d';
    const body =
      handlerId === 'ssf.organisation-keys.prepare'
        ? { publicKey: 'A'.repeat(87), expectedActiveKeyId: null }
        : {
            conversationIds: [id],
            organisationKeyId: id,
            targetUserSub: 'target',
            expectedTargetKeyVersion: 1,
            expectedTargetFingerprint: 'A'.repeat(43),
            reason: 'restore',
          };
    const forwardSsfRecordingRequest = vi.fn().mockResolvedValue(
      Response.json(
        {
          detail: {
            error_code: 'RECORDING_PROTOCOL_UPGRADE_REQUIRED',
            message: 'sensitive upstream details',
          },
        },
        { status: 409 }
      )
    );
    const result = await getHandler(handlerId)({
      ...ctx,
      handlerId,
      request: new Request('https://studio.test/api', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      forwardSsfRecordingRequest,
    });
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: { code: 'RECORDING_PROTOCOL_UPGRADE_REQUIRED' } });
    expect(forwardSsfRecordingRequest).toHaveBeenCalledTimes(1);
  }
);

const candidateHandler = getHandler('ssf.access-transfer.candidates');
it.each([
  '',
  '?employeeSub=a&employeeSub=b',
  '?other=b&employeeSub=a',
  '?employeeSub=a&cursor=',
  '?employeeSub=a&cursor=' + 'x'.repeat(2049),
])(
  'rejects missing, duplicate, extra and out-of-range candidate query parameters',
  async (query) => {
    const forwardSsfRecordingRequest = vi.fn();
    const res = await candidateHandler({
      ...ctx,
      request: new Request('https://studio.test/api' + query),
      forwardSsfRecordingRequest,
    });
    expect(res.status).toBe(422);
    expect(forwardSsfRecordingRequest).not.toHaveBeenCalled();
  }
);

it('forwards only validated candidate pagination and source identity', async () => {
  const forwardSsfRecordingRequest = vi
    .fn()
    .mockResolvedValue(Response.json({ items: [], nextCursor: null }));
  const res = await candidateHandler({
    ...ctx,
    request: new Request('https://studio.test/api?employeeSub=old-user&cursor=next'),
    forwardSsfRecordingRequest,
  });
  expect(res.status).toBe(200);
  expect(forwardSsfRecordingRequest).toHaveBeenCalledWith({
    method: 'GET',
    path: '/access-transfer/candidates?employeeSub=old-user&cursor=next',
  });
});

it('only returns tenant directory people and the bounded display label', async () => {
  const readPermissionDirectorySubjects = vi.fn().mockResolvedValue([
    {
      keycloakSubject: 'person',
      displayName: 'A'.repeat(220),
      languages: ['de'],
      permissionIds: ['private'],
    },
  ]);
  const people = getHandler('ssf.access-transfer.people', { readPermissionDirectorySubjects });
  const context = { ...ctx, request: new Request('https://studio.test/api') };
  const res = await people(context);
  expect(await res.json()).toEqual({ users: [{ sub: 'person', displayName: 'A'.repeat(200) }] });
  expect(readPermissionDirectorySubjects).toHaveBeenCalledWith(
    expect.objectContaining({ instanceId: 'tenant' })
  );
  expect((await people({ ...context, scope: 'platform' })).status).toBe(503);
  expect(readPermissionDirectorySubjects).toHaveBeenCalledTimes(1);
  readPermissionDirectorySubjects.mockRejectedValueOnce(new Error('private'));
  expect((await people(context)).status).toBe(503);
});

it('validates abandon preparation IDs and emits an empty 204 success', async () => {
  const abandon = getHandler('ssf.organisation-keys.abandon');
  const id = '122db777-aeaa-488f-b099-92af0709bc8d';
  const forwardSsfRecordingRequest = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const context = {
    ...ctx,
    request: new Request('https://studio.test/api', { method: 'DELETE' }),
    forwardSsfRecordingRequest,
  };
  expect((await abandon({ ...context, pathParams: { id: 'bad' } })).status).toBe(422);
  const res = await abandon({ ...context, pathParams: { id } });
  expect(res.status).toBe(204);
  expect(await res.text()).toBe('');
  expect(forwardSsfRecordingRequest).toHaveBeenCalledExactlyOnceWith({
    method: 'DELETE',
    path: '/organisation-keys/preparations/' + id,
  });
});

it('encodes and bounds a requested target subject', async () => {
  const handler = getHandler('ssf.access-transfer.target');
  const forwardSsfRecordingRequest = vi
    .fn()
    .mockResolvedValue(Response.json({ error: { code: 'PERMISSION_REQUIRED' } }, { status: 403 }));
  const context = {
    ...ctx,
    request: new Request('https://studio.test/api'),
    forwardSsfRecordingRequest,
  };
  expect((await handler({ ...context, pathParams: { sub: 'a/b' } })).status).toBe(422);
  expect((await handler({ ...context, pathParams: { sub: 'a@b' } })).status).toBe(403);
  expect(forwardSsfRecordingRequest).toHaveBeenCalledExactlyOnceWith({
    method: 'GET',
    path: '/access-transfer/targets/a%40b',
  });
});

it('rejects declared and streamed request bodies above the input limit', async () => {
  const handler = getHandler(ctx.handlerId);
  const forwardSsfRecordingRequest = vi.fn();
  const limit = 512 * 1024;
  for (const init of [
    { headers: { 'content-length': String(limit + 1) }, body: '{}' },
    { body: 'a'.repeat(limit + 1) },
  ]) {
    const res = await handler({
      ...ctx,
      request: new Request('https://studio.test/api', { method: 'POST', ...init }),
      forwardSsfRecordingRequest,
    });
    expect(res.status).toBe(422);
  }
  expect(forwardSsfRecordingRequest).not.toHaveBeenCalled();
});

it.each([
  new Response('upstream private cause', { status: 500 }),
  Response.json({ code: 'PRIVATE_PROVIDER_CODE' }, { status: 500 }),
  new Response(null, { status: 500 }),
  new Response('x'.repeat(8193), { status: 500 }),
])('redacts unreadable, oversized and unknown upstream failures', async (upstream) => {
  const handler = getHandler('ssf.organisation-keys.read');
  const res = await handler({
    ...ctx,
    request: new Request('https://studio.test/api'),
    forwardSsfRecordingRequest: async () => upstream,
  });
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: { code: 'RECORDING_UNAVAILABLE' } });
});

it('requires the forwarded session capability before accepting recording operations', async () => {
  const handler = getHandler('ssf.organisation-keys.read');
  const res = await handler({ ...ctx, request: new Request('https://studio.test/api') });
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: { code: 'RECORDING_UNAVAILABLE' } });
});

it.each([
  new Request('https://studio.test/api?tenantId=other'),
  new Request('https://studio.test/api', { method: 'POST', body: '{}' }),
])('rejects unexpected inputs on a read operation', async (request) => {
  const forwardSsfRecordingRequest = vi.fn();
  const handler = getHandler('ssf.organisation-keys.read');
  expect((await handler({ ...ctx, request, forwardSsfRecordingRequest })).status).toBe(422);
  expect(forwardSsfRecordingRequest).not.toHaveBeenCalled();
});
