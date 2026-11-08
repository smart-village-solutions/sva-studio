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

import { FakeKeycloak } from '../../tests/keycloak-admin-client.test-fixtures.js';

const optional = { mode: 'optional' as const, clientIds: ['sva-studio-login', 'ssf'] };
const root = 'studio-login-mfa-v1-optional';
const setup = () => {
  const keycloak = new FakeKeycloak();
  keycloak.clients.set('ssf', { id: 'ssf-client', clientId: 'ssf' });
  const client = new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example',
    realm: 'demo',
    clientId: 'provisioner',
    clientSecret: 'fixture',
    fetchImpl: keycloak.fetch,
    connectTimeoutMs: 0,
    sleep: async () => undefined,
  });
  return { keycloak, client };
};
const storedClient = (keycloak: FakeKeycloak, name: string) => {
  const client = keycloak.clients.get(name);
  if (!client) throw new Error(`missing_test_client:${name}`);
  return client;
};
const executions = (keycloak: FakeKeycloak, parent: string) => {
  const entries = keycloak.executions.get(parent);
  if (!entries) throw new Error(`missing_test_flow:${parent}`);
  return entries;
};
const execution = (keycloak: FakeKeycloak, parent: string, name: string) => {
  const entry = keycloak.executions.get(parent)?.find((item) => item.displayName === name);
  if (!entry) throw new Error(`missing_test_execution:${parent}:${name}`);
  return entry;
};
const mapper = (keycloak: FakeKeycloak) => {
  const result = keycloak.mappers
    .get('studio-client')
    ?.find((item) => item.name === 'studio-login-mfa-acr');
  if (!result) throw new Error('missing_test_mapper');
  return result;
};
const loaConfig = (keycloak: FakeKeycloak) => {
  const entry = execution(keycloak, `${root}-stepup`, 'Condition - Level of Authentication');
  const config = keycloak.configs.get(entry.authenticationConfig ?? '');
  if (!config) throw new Error('missing_test_config');
  return config;
};

describe('managed login MFA provider contract', () => {
  it.each(['optional', 'required'] as const)(
    'provisions %s and is idempotent after verified read-back',
    async (mode) => {
      const { keycloak, client } = setup();
      keycloak.realm.attributes = { custom: 'retained', 'acr.loa.map': '{"custom-acr":7}' };
      storedClient(keycloak, 'ssf').attributes = { custom: 'client-retained' };
      keycloak.mappers.set('studio-client', [
        { id: 'custom', name: 'unrelated', config: { custom: 'retained' } },
      ]);
      const policy = { ...optional, mode, clientIds: [...optional.clientIds, 'ssf'] };
      await client.ensureLoginMfaPolicy(policy);
      expect(await client.readLoginMfaPolicy(policy)).toEqual({ aligned: true, mode });
      expect(keycloak.realm).toMatchObject({
        browserFlow: `studio-login-mfa-v1-${mode}`,
        attributes: { custom: 'retained' },
      });
      expect(JSON.parse(keycloak.realm.attributes?.['acr.loa.map'] ?? '{}')).toEqual({
        'custom-acr': 7,
        pwd: 1,
        mfa: 2,
      });
      expect(keycloak.actions).toEqual([
        { alias: 'CONFIGURE_TOTP', enabled: true, defaultAction: false },
      ]);
      expect(keycloak.clients.get('ssf')).toMatchObject({
        attributes: {
          custom: 'client-retained',
          'default.acr.values': mode === 'optional' ? 'pwd' : 'mfa',
        },
      });
      expect(keycloak.mappers.get('studio-client')).toContainEqual({
        id: 'custom',
        name: 'unrelated',
        config: { custom: 'retained' },
      });
      expect(mapper(keycloak)).toMatchObject({
        protocolMapper: 'oidc-acr-mapper',
        config: { 'access.token.claim': 'true', 'id.token.claim': 'true' },
      });
      const ordinary = execution(
        keycloak,
        `studio-login-mfa-v1-${mode}`,
        `studio-login-mfa-v1-${mode}-ordinary`
      );
      expect(ordinary.requirement).toBe(mode === 'optional' ? 'CONDITIONAL' : 'REQUIRED');
      const count = keycloak.requests.length;
      await client.ensureLoginMfaPolicy(policy);
      expect(keycloak.adminWritesSince(count)).toEqual([]);
    }
  );

  const repairableDrift: [string, (keycloak: FakeKeycloak) => void][] = [
    [
      'execution requirement',
      (k) => {
        execution(k, `${root}-ordinary`, 'OTP Form').requirement = 'DISABLED';
      },
    ],
    [
      'execution order',
      (k) => {
        execution(k, `${root}-ordinary`, 'OTP Form').priority = 999;
      },
    ],
    [
      'missing execution',
      (k) => {
        k.executions.set(
          `${root}-ordinary`,
          executions(k, `${root}-ordinary`).filter((entry) => entry.displayName !== 'OTP Form')
        );
      },
    ],
    [
      'LoA strength',
      (k) => {
        loaConfig(k).config['loa-condition-level'] = '1';
      },
    ],
    [
      'LoA freshness',
      (k) => {
        loaConfig(k).config['loa-max-age'] = '36000';
      },
    ],
    [
      'missing authenticator config',
      (k) => {
        delete execution(k, `${root}-stepup`, 'Condition - Level of Authentication')
          .authenticationConfig;
      },
    ],
    [
      'disabled enrollment',
      (k) => {
        k.actions[0].enabled = false;
      },
    ],
    [
      'forced enrollment in optional mode',
      (k) => {
        k.actions[0].defaultAction = true;
      },
    ],
    [
      'missing ACR mapping',
      (k) => {
        delete k.realm.attributes;
      },
    ],
    [
      'wrong ACR mapping',
      (k) => {
        k.realm.attributes = { 'acr.loa.map': '{"pwd":2,"mfa":1}' };
      },
    ],
    [
      'default realm binding',
      (k) => {
        k.realm.browserFlow = 'browser';
      },
    ],
    [
      'missing client defaults',
      (k) => {
        delete storedClient(k, 'sva-studio-login').attributes;
      },
    ],
    [
      'wrong mapper provider',
      (k) => {
        mapper(k).protocolMapper = 'custom-provider';
      },
    ],
    [
      'missing access claim',
      (k) => {
        (mapper(k).config as Record<string, string>)['access.token.claim'] = 'false';
      },
    ],
    [
      'missing ID claim',
      (k) => {
        (mapper(k).config as Record<string, string>)['id.token.claim'] = 'false';
      },
    ],
    [
      'missing mapper',
      (k) => {
        k.mappers.set('studio-client', []);
      },
    ],
  ];
  it.each(repairableDrift)('detects and repairs %s', async (_name, damage) => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    damage(keycloak);
    const count = keycloak.requests.length;
    expect(await client.readLoginMfaPolicy(optional)).toEqual({ aligned: false, mode: 'optional' });
    expect(keycloak.adminWritesSince(count)).toEqual([]);
    await client.ensureLoginMfaPolicy(optional);
    expect(await client.readLoginMfaPolicy(optional)).toEqual({ aligned: true, mode: 'optional' });
    expect(keycloak.adminWritesSince(count).length).toBeGreaterThan(0);
  });

  it('moves owned client overrides with policy transitions, preserving other bindings', async () => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    storedClient(keycloak, 'ssf').authenticationFlowBindingOverrides = {
      browser: `flow-${root}`,
      direct_grant: 'custom-direct-flow',
    };
    await client.ensureLoginMfaPolicy({ ...optional, mode: 'required' });
    expect(keycloak.clients.get('ssf')).toMatchObject({
      authenticationFlowBindingOverrides: {
        browser: 'flow-studio-login-mfa-v1-required',
        direct_grant: 'custom-direct-flow',
      },
    });
    // A previously owned override can drift back independently of the realm policy.
    storedClient(keycloak, 'ssf').authenticationFlowBindingOverrides = { browser: `flow-${root}` };
    expect(await client.readLoginMfaPolicy({ ...optional, mode: 'required' })).toEqual({
      aligned: false,
      mode: 'required',
    });
    await client.ensureLoginMfaPolicy({ ...optional, mode: 'required' });
    expect(await client.readLoginMfaPolicy({ ...optional, mode: 'required' })).toEqual({
      aligned: true,
      mode: 'required',
    });
  });

  it.each(['realm', 'flow owner', 'client'] as const)(
    'rejects foreign %s ownership before any provider write',
    async (kind) => {
      const { keycloak, client } = setup();
      if (kind === 'realm') keycloak.realm.browserFlow = 'custom-login';
      if (kind === 'flow owner')
        keycloak.flows.push({
          id: 'foreign',
          alias: root,
          topLevel: true,
          description: 'administrator-owned',
        });
      if (kind === 'client')
        storedClient(keycloak, 'ssf').authenticationFlowBindingOverrides = {
          browser: 'custom-flow',
        };
      const before = structuredClone({
        realm: keycloak.realm,
        flows: keycloak.flows,
        clients: [...keycloak.clients],
      });
      await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow(
        'login_mfa_binding_conflict'
      );
      await expect(client.readLoginMfaPolicy(optional)).rejects.toThrow(
        'login_mfa_binding_conflict'
      );
      expect(keycloak.adminWritesSince(0)).toEqual([]);
      expect({
        realm: keycloak.realm,
        flows: keycloak.flows,
        clients: [...keycloak.clients],
      }).toEqual(before);
    }
  );

  it.each(['duplicate execution', 'wrong authenticator', 'wrong subflow'] as const)(
    'does not certify or overwrite an ambiguous %s',
    async (kind) => {
      const { keycloak, client } = setup();
      await client.ensureLoginMfaPolicy(optional);
      const entry = execution(keycloak, `${root}-ordinary`, 'OTP Form');
      if (kind === 'duplicate execution')
        executions(keycloak, `${root}-ordinary`).push({ ...entry, id: 'custom-duplicate' });
      if (kind === 'wrong authenticator') entry.providerId = 'custom-otp';
      if (kind === 'wrong subflow')
        execution(keycloak, root, `${root}-identity`).authenticationFlow = false;
      const count = keycloak.requests.length;
      expect(await client.readLoginMfaPolicy(optional)).toEqual({
        aligned: false,
        mode: 'optional',
      });
      await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow(
        'login_mfa_execution_conflict'
      );
      expect(keycloak.adminWritesSince(count)).toEqual([]);
    }
  );

  it('requires every named client before writes and reports a deleted client as unverified', async () => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    keycloak.clients.delete('ssf');
    const count = keycloak.requests.length;
    expect(await client.readLoginMfaPolicy(optional)).toEqual({ aligned: false, mode: 'optional' });
    await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow('login_mfa_client_missing');
    expect(keycloak.adminWritesSince(count)).toEqual([]);
  });

  it('rejects an absent OTP enrollment action rather than certifying a partial policy', async () => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    keycloak.actions = [];
    expect(await client.readLoginMfaPolicy(optional)).toEqual({ aligned: false, mode: 'optional' });
    await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow(
      'login_mfa_otp_action_missing'
    );
  });

  it('fails read-back after an acknowledged but ineffective write and can safely retry', async () => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    loaConfig(keycloak).config['loa-max-age'] = '36000';
    keycloak.intercept = ({ method, path }) =>
      method === 'PUT' && path.includes('/authentication/config/')
        ? new Response(null, { status: 204 })
        : undefined;
    await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow(
      'login_mfa_readback_mismatch'
    );
    keycloak.intercept = undefined;
    await client.ensureLoginMfaPolicy(optional);
    expect(loaConfig(keycloak).config['loa-max-age']).toBe('0');
    expect(await client.readLoginMfaPolicy(optional)).toEqual({ aligned: true, mode: 'optional' });
  });

  it('fails if a provider accepts creation without retaining the managed root flow', async () => {
    const { keycloak, client } = setup();
    keycloak.intercept = ({ method, path }) =>
      method === 'POST' && path.endsWith('/authentication/flows')
        ? new Response(null, { status: 204 })
        : undefined;
    await expect(client.ensureLoginMfaPolicy(optional)).rejects.toThrow('login_mfa_flow_missing');
  });

  it.each([
    'invalid JSON',
    'malformed mapping',
    'malformed execution list',
    'missing mapper config',
  ])('fails closed on %s provider data', async (kind) => {
    const { keycloak, client } = setup();
    await client.ensureLoginMfaPolicy(optional);
    if (kind === 'malformed mapping') keycloak.realm.attributes = { 'acr.loa.map': '{invalid' };
    if (kind === 'missing mapper config') delete mapper(keycloak).config;
    keycloak.intercept = ({ method, path }) => {
      if (method !== 'GET') return;
      if (kind === 'invalid JSON' && path === '/admin/realms/demo')
        return new Response('{invalid', { headers: { 'content-type': 'application/json' } });
      if (kind === 'malformed execution list' && path.endsWith('/executions'))
        return Response.json({ invalid: true });
    };
    const count = keycloak.requests.length;
    await expect(client.readLoginMfaPolicy(optional)).rejects.toThrow();
    expect(keycloak.adminWritesSince(count)).toEqual([]);
  });
});
