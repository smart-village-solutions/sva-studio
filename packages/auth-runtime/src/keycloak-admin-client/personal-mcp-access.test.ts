import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => logger }));

type Execution = {
  id: string;
  displayName: string;
  providerId?: string;
  authenticationFlow?: boolean;
  flowId?: string;
  authenticationConfig?: string;
  requirement: string;
  priority: number;
  level: number;
};

type RequestRecord = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
};

const json = (payload: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const empty = (status = 204, headers?: HeadersInit): Response =>
  new Response(null, { status, headers });

const providerDisplayNames: Record<string, string> = {
  'auth-cookie': 'Cookie',
  'auth-otp-form': 'OTP Form',
  'auth-username-password-form': 'Username Password Form',
  'conditional-user-attribute': 'Condition - user attribute',
  'conditional-user-configured': 'Condition - user configured',
  'deny-access-authenticator': 'Deny access',
};

class FakeKeycloak {
  readonly requests: RequestRecord[] = [];
  readonly executions = new Map<string, Execution[]>();
  readonly configs = new Map<string, { id: string; alias: string; config: Record<string, string> }>();
  readonly mappers = new Map<string, Record<string, unknown>[]>();
  readonly clients = new Map<string, Record<string, unknown>>([
    ['sva-studio-login', { id: 'studio-client', clientId: 'sva-studio-login' }],
  ]);
  profile: Record<string, unknown> = { attributes: [] };
  flows: Record<string, unknown>[] = [];
  ignoreClientBindingUpdate = false;
  private nextId = 1;

  readonly fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname.endsWith('/protocol/openid-connect/token')) {
      return json({ access_token: 'token-1', expires_in: 120 });
    }
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    const path = `${url.pathname}${url.search}`;
    this.requests.push({ method, path, body });

    const base = '/admin/realms/demo';
    if (url.pathname === `${base}/users/profile`) {
      if (method === 'GET') return json(this.profile);
      this.profile = body ?? {};
      return empty();
    }

    if (url.pathname === `${base}/authentication/flows`) {
      if (method === 'GET') return json(this.flows);
      const alias = String(body?.alias);
      this.flows.push({ ...body, id: `flow-${alias}` });
      return empty();
    }

    const flowExecutions = url.pathname.match(
      new RegExp(`^${base}/authentication/flows/([^/]+)/executions$`)
    );
    if (flowExecutions) {
      const parent = decodeURIComponent(flowExecutions[1]);
      if (method === 'GET') return json(this.executions.get(parent) ?? []);
      const entry = (this.executions.get(parent) ?? []).find(
        (candidate) => candidate.id === body?.id
      );
      if (!entry) return json({ error: 'execution_not_found' }, 404);
      Object.assign(entry, body);
      return empty();
    }

    const subflow = url.pathname.match(
      new RegExp(`^${base}/authentication/flows/([^/]+)/executions/flow$`)
    );
    if (subflow && method === 'POST') {
      const parent = decodeURIComponent(subflow[1]);
      const alias = String(body?.alias);
      this.addExecution(parent, {
        displayName: alias,
        authenticationFlow: true,
        flowId: `flow-${alias}`,
      });
      return empty();
    }

    const authenticator = url.pathname.match(
      new RegExp(`^${base}/authentication/flows/([^/]+)/executions/execution$`)
    );
    if (authenticator && method === 'POST') {
      const parent = decodeURIComponent(authenticator[1]);
      const provider = String(body?.provider);
      this.addExecution(parent, {
        displayName: providerDisplayNames[provider] ?? provider,
        providerId: provider,
      });
      return empty();
    }

    const executionConfig = url.pathname.match(
      new RegExp(`^${base}/authentication/executions/([^/]+)/config$`)
    );
    if (executionConfig && method === 'POST') {
      const executionId = decodeURIComponent(executionConfig[1]);
      const id = `config-${this.nextId++}`;
      const config = { id, alias: String(body?.alias), config: body?.config as Record<string, string> };
      this.configs.set(id, config);
      for (const entries of this.executions.values()) {
        const entry = entries.find((candidate) => candidate.id === executionId);
        if (entry) entry.authenticationConfig = id;
      }
      return empty();
    }

    const configPath = url.pathname.match(
      new RegExp(`^${base}/authentication/config/([^/]+)$`)
    );
    if (configPath) {
      const id = decodeURIComponent(configPath[1]);
      if (method === 'GET') return json(this.configs.get(id));
      this.configs.set(id, { ...(body as never), id });
      return empty();
    }

    if (url.pathname === `${base}/clients` && method === 'GET') {
      const clientId = url.searchParams.get('clientId') ?? '';
      const client = this.clients.get(clientId);
      return json(client ? [client] : []);
    }
    if (url.pathname === `${base}/clients` && method === 'POST') {
      const clientId = String(body?.clientId);
      const id = 'personal-client';
      this.clients.set(clientId, { ...body, id });
      return empty(201, { location: `https://keycloak.example${base}/clients/${id}` });
    }

    const clientPath = url.pathname.match(new RegExp(`^${base}/clients/([^/]+)$`));
    if (clientPath && method === 'PUT') {
      const clientId = String(body?.clientId);
      if (!(this.ignoreClientBindingUpdate && body?.authenticationFlowBindingOverrides)) {
        this.clients.set(clientId, body ?? {});
      }
      return empty();
    }

    const mapperPath = url.pathname.match(
      new RegExp(`^${base}/clients/([^/]+)/protocol-mappers/models(?:/([^/]+))?$`)
    );
    if (mapperPath) {
      const clientInternalId = decodeURIComponent(mapperPath[1]);
      if (method === 'GET') return json(this.mappers.get(clientInternalId) ?? []);
      const mappers = this.mappers.get(clientInternalId) ?? [];
      if (method === 'POST') mappers.push({ ...body, id: `mapper-${this.nextId++}` });
      if (method === 'PUT') {
        const mapperId = decodeURIComponent(mapperPath[2]);
        const index = mappers.findIndex((mapper) => mapper.id === mapperId);
        if (index >= 0) mappers[index] = body ?? {};
      }
      this.mappers.set(clientInternalId, mappers);
      return empty();
    }

    return json({ error: `unhandled:${method}:${path}` }, 500);
  });

  private addExecution(
    parent: string,
    input: Pick<Execution, 'displayName'> & Partial<Execution>
  ): void {
    const entries = this.executions.get(parent) ?? [];
    entries.push({
      id: `execution-${this.nextId++}`,
      requirement: 'DISABLED',
      priority: 0,
      level: 0,
      ...input,
    });
    this.executions.set(parent, entries);
  }

  adminWritesSince(index: number): RequestRecord[] {
    return this.requests.slice(index).filter((request) => request.method !== 'GET');
  }
}

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
