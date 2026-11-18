import { expect, it, vi } from 'vitest';
import { KeycloakAdminClient } from './core.js';

const owned = {
  id: 'login-internal-id',
  clientId: 'studio',
  standardFlowEnabled: true,
  publicClient: false,
  redirectUris: ['https://tenant.example.test/callback'],
  attributes: {
    managed_by: 'studio',
    instance_id: 'tenant-a',
    artifact_key: 'login_client',
    unrelated: 'preserved',
  },
};
const enabled = {
  ...owned,
  attributes: { ...owned.attributes, 'standard.token.exchange.enabled': 'true' },
};
const fixture = (...responses: Response[]) => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'fixture', expires_in: 120 }));
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  const admin = new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example.test',
    realm: 'tenant-a',
    clientId: 'provisioner',
    clientSecret: 'fixture',
    fetchImpl,
    now: () => 0,
    sleep: async () => undefined,
  });
  return { fetchImpl, ensure: () => admin.ensureSsfRecordingExchange('studio', 'tenant-a') };
};

it.each([
  ['missing', []],
  ['public', [{ ...owned, publicClient: true }]],
  ['no standard flow', [{ ...owned, standardFlowEnabled: false }]],
  ['no ownership', [{ ...owned, attributes: undefined }]],
  ['wrong manager', [{ ...owned, attributes: { ...owned.attributes, managed_by: 'external' } }]],
  ['wrong tenant', [{ ...owned, attributes: { ...owned.attributes, instance_id: 'other' } }]],
  [
    'wrong client role',
    [{ ...owned, attributes: { ...owned.attributes, artifact_key: 'tenant_admin' } }],
  ],
])('rejects %s login clients before writing', async (_case, clients) => {
  const { ensure, fetchImpl } = fixture(Response.json(clients));
  await expect(ensure()).rejects.toThrow('ssf_exchange_client_invalid');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('leaves an already enabled owned exchange unchanged', async () => {
  const { ensure, fetchImpl } = fixture(Response.json([enabled]));
  await expect(ensure()).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('keeps the complete owned representation when enabling exchange and checks readback', async () => {
  const { ensure, fetchImpl } = fixture(
    Response.json([owned]),
    new Response(null, { status: 204 }),
    Response.json([enabled])
  );
  await expect(ensure()).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  const [url, init] = fetchImpl.mock.calls[2]!;
  expect(String(url)).toBe(
    'https://keycloak.example.test/admin/realms/tenant-a/clients/login-internal-id'
  );
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual(enabled);
});

it.each([
  { readback: [] },
  { readback: [owned] },
  { readback: [{ ...owned, attributes: undefined }] },
])('requires persisted exchange enablement after a successful write %#', async ({ readback }) => {
  const { ensure } = fixture(
    Response.json([owned]),
    new Response(null, { status: 204 }),
    Response.json(readback)
  );
  await expect(ensure()).rejects.toThrow('ssf_exchange_client_readback_failed');
});
