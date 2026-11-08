import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => logger }));

import { FakeKeycloak } from '../../tests/keycloak-admin-client.test-fixtures.js';

const createClient = async (keycloak: FakeKeycloak) => {
  const { KeycloakAdminClient } = await import('./core.js');
  return new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example',
    realm: 'demo',
    clientId: 'provisioner',
    clientSecret: 'secret',
    fetchImpl: keycloak.fetch,
    connectTimeoutMs: 0,
    now: () => 0,
    sleep: async () => undefined,
  });
};

describe('personal MCP access provisioning', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates, repairs and idempotently verifies the complete client-bound flow', async () => {
    const keycloak = new FakeKeycloak();
    const client = await createClient(keycloak);

    await client.ensurePersonalMcpAccess('sva-studio-login');

    expect(keycloak.profile).toEqual({
      attributes: [{
        name: 'svaStudioMcpAccess',
        multivalued: false,
        permissions: { view: ['admin'], edit: ['admin'] },
      }],
    });
    expect(keycloak.flows).toContainEqual(expect.objectContaining({
      alias: 'sva-studio-mcp-personal-browser',
      topLevel: true,
    }));
    expect(keycloak.executions.get('sva-studio-mcp-personal-browser')).toEqual([
      expect.objectContaining({ displayName: 'sva-studio-mcp-personal-login', requirement: 'REQUIRED', priority: 0 }),
      expect.objectContaining({ displayName: 'sva-studio-mcp-personal-guard', requirement: 'CONDITIONAL', priority: 10 }),
    ]);
    const guardConfig = [...keycloak.configs.values()][0];
    expect(guardConfig?.config).toEqual(expect.objectContaining({
      attribute_name: 'svaStudioMcpAccess',
      attribute_expected_value: 'true',
      not: 'true',
    }));
    expect(keycloak.clients.get('sva-studio-mcp-personal')).toEqual(expect.objectContaining({
      enabled: false,
      publicClient: true,
      redirectUris: ['http://127.0.0.1:8765/callback'],
      authenticationFlowBindingOverrides: { browser: 'flow-sva-studio-mcp-personal-browser' },
    }));
    expect(keycloak.mappers.get('personal-client')).toContainEqual(expect.objectContaining({
      name: 'sva-studio-api-audience',
      config: expect.objectContaining({ 'included.client.audience': 'sva-studio-login' }),
    }));

    if (!guardConfig) throw new Error('guard config missing from fake Keycloak');
    guardConfig.config.attribute_expected_value = 'false';
    const repairStart = keycloak.requests.length;
    await client.ensurePersonalMcpAccess('sva-studio-login');
    expect(keycloak.adminWritesSince(repairStart)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        path: expect.stringContaining(`/authentication/config/${guardConfig.id}`),
      }),
    ]);
    expect(keycloak.configs.get(guardConfig.id)?.config.attribute_expected_value).toBe('true');

    const idempotentStart = keycloak.requests.length;
    await client.ensurePersonalMcpAccess('sva-studio-login');
    expect(keycloak.adminWritesSince(idempotentStart)).toEqual([]);
  });

  it('fails closed when the personal client flow binding cannot be read back', async () => {
    const keycloak = new FakeKeycloak();
    const client = await createClient(keycloak);
    await client.ensurePersonalMcpAccess('sva-studio-login');
    const personal = keycloak.clients.get('sva-studio-mcp-personal');
    if (!personal) throw new Error('personal client missing from fake Keycloak');
    personal.authenticationFlowBindingOverrides = {};
    keycloak.ignoreClientBindingUpdate = true;

    await expect(client.ensurePersonalMcpAccess('sva-studio-login')).rejects.toThrow(
      'personal_mcp_client_binding_readback_mismatch'
    );
  });
});
