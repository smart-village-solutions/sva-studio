import { describe, expect, it, vi } from 'vitest';
import { KeycloakAdminClient } from './core.js';
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('tenant login MFA ownership', () => {
  it('preserves administrator managed realm bindings before any mutation', async () => {
    const writes: string[] = [];
    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'provisioner',
      clientSecret: 'fixture',
      connectTimeoutMs: 0,
      fetchImpl: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/token'))
          return Response.json({ access_token: 'test', expires_in: 120 });
        if (init?.method && init.method !== 'GET') writes.push(path);
        if (path === '/admin/realms/demo')
          return Response.json({ realm: 'demo', browserFlow: 'custom-login' });
        return Response.json([]);
      },
    });
    await expect(
      client.ensureLoginMfaPolicy({ mode: 'required', clientIds: ['studio'] })
    ).rejects.toThrow('login_mfa_binding_conflict');
    expect(writes).toEqual([]);
  });
});

it('reports a missing client as unverified so provisioning can create it', async () => {
  const client = new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example',
    realm: 'demo',
    clientId: 'provisioner',
    clientSecret: 'fixture',
    connectTimeoutMs: 0,
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/token')) return Response.json({ access_token: 'test', expires_in: 120 });
      if (path === '/admin/realms/demo')
        return Response.json({ realm: 'demo', browserFlow: 'browser' });
      return Response.json([]);
    },
  });
  await expect(
    client.readLoginMfaPolicy({ mode: 'optional', clientIds: ['missing'] })
  ).resolves.toEqual({ mode: 'optional', aligned: false });
});
