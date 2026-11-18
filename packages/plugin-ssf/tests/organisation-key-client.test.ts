import { afterEach, expect, it, vi } from 'vitest';
import { readPeople, requestOperation } from '../src/organisation-key-client.js';
import { pluginRecordingBase } from '../src/organisation-key-contracts.js';

const preparationId = '41c5182c-d260-4d69-83ae-16733f5978fb';
const signal = new AbortController().signal;
const mockResponse = (response: Response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
afterEach(() => vi.unstubAllGlobals());

it('reads the public directory through the active same-origin session and cancellation signal', async () => {
  const users = [{ sub: 'tenant-user', displayName: 'Tenant User' }];
  const fetch = mockResponse(Response.json({ users }));
  expect(await readPeople(signal)).toEqual(users);
  expect(fetch).toHaveBeenCalledWith(pluginRecordingBase + '/access-transfer/people', {
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
  });
});

it.each([
  [401, 'AUTHENTICATION_REQUIRED'],
  [403, 'PERMISSION_REQUIRED'],
  [502, 'RECORDING_UNAVAILABLE'],
] as const)(
  'classifies directory and unstructured operation errors for HTTP %s',
  async (status, code) => {
    const fetch = mockResponse(new Response('unstructured body', { status }));
    await expect(readPeople(signal)).rejects.toThrow(code);
    fetch.mockResolvedValueOnce(new Response(null, { status }));
    await expect(requestOperation('list')).rejects.toThrow(code);
  }
);

it('exposes the allowlisted upgrade conflict and suppresses unknown internal diagnostics', async () => {
  const fetch = mockResponse(
    Response.json({ error: { code: 'RECORDING_PROTOCOL_UPGRADE_REQUIRED' } }, { status: 409 })
  );
  await expect(requestOperation('list')).rejects.toThrow('RECORDING_PROTOCOL_UPGRADE_REQUIRED');
  fetch.mockResolvedValueOnce(
    Response.json({ error: { code: 'internal_detail' } }, { status: 409 })
  );
  await expect(requestOperation('list')).rejects.toThrow('RECORDING_UNAVAILABLE');
});

it('validates mutation payloads and path segments before sending them', async () => {
  const fetch = mockResponse(new Response(null, { status: 204 }));
  await expect(requestOperation('abandon', { id: '../untrusted' })).rejects.toThrow();
  await expect(requestOperation('target', { sub: 'some/other/user' })).rejects.toThrow();
  await expect(
    requestOperation('prepareKey', { body: { publicKey: 'malformed' } })
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(await requestOperation('abandon', { id: preparationId, signal })).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    pluginRecordingBase + '/organisation-keys/preparations/' + preparationId,
    expect.objectContaining({
      method: 'DELETE',
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: expect.any(Headers),
    })
  );
});

it('encodes a target subject and query and rejects malformed successful response envelopes', async () => {
  const fetch = mockResponse(Response.json({ unexpected: true }));
  await expect(requestOperation('target', { sub: 'user@example.org' })).rejects.toThrow();
  expect(fetch.mock.calls[0]?.[0]).toBe(
    pluginRecordingBase + '/access-transfer/targets/user%40example.org'
  );
  fetch.mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }));
  await requestOperation('candidates', {
    query: new URLSearchParams({ employeeSub: 'user@example.org' }),
  });
  expect(fetch.mock.calls[1]?.[0]).toBe(
    pluginRecordingBase + '/access-transfer/candidates?employeeSub=user%40example.org'
  );
  fetch.mockResolvedValueOnce(
    Response.json({ users: [{ sub: '../invalid', displayName: 'user' }] })
  );
  await expect(readPeople(signal)).rejects.toThrow();
});

it('sends schema-validated JSON with the mutation method', async () => {
  const fetch = mockResponse(
    Response.json({ error: { code: 'RECORDING_UNAVAILABLE' } }, { status: 503 })
  );
  const body = { savedConfirmation: true, proof: 'A'.repeat(43) };
  await expect(requestOperation('activate', { id: preparationId, body })).rejects.toThrow(
    'RECORDING_UNAVAILABLE'
  );
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual(body);
});
