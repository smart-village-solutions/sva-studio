import { vi } from 'vitest';

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
  'conditional-level-of-authentication': 'Condition - Level of Authentication',
  'conditional-credential': 'Condition - credential',
  'allow-access-authenticator': 'Allow access',
};

export class FakeKeycloak {
  readonly requests: RequestRecord[] = [];
  readonly executions = new Map<string, Execution[]>();
  readonly configs = new Map<
    string,
    { id: string; alias: string; config: Record<string, string> }
  >();
  readonly mappers = new Map<string, Record<string, unknown>[]>();
  readonly clients = new Map<string, Record<string, unknown>>([
    ['sva-studio-login', { id: 'studio-client', clientId: 'sva-studio-login' }],
  ]);
  realm: { realm: string; browserFlow?: string; attributes?: Record<string, string> } = {
    realm: 'demo',
    browserFlow: 'browser',
  };
  actions = [{ alias: 'CONFIGURE_TOTP', enabled: false, defaultAction: true }];
  intercept?: (request: RequestRecord) => Response | undefined;
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
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    const path = `${url.pathname}${url.search}`;
    this.requests.push({ method, path, body });

    const intercepted = this.intercept?.({ method, path, body });
    if (intercepted) return intercepted;
    const base = '/admin/realms/demo';
    if (url.pathname === base) {
      if (method === 'GET') return json(this.realm);
      Object.assign(this.realm, body);
      return empty();
    }
    if (url.pathname === `${base}/authentication/required-actions`) return json(this.actions);
    if (url.pathname === `${base}/authentication/required-actions/CONFIGURE_TOTP`) {
      Object.assign(this.actions.find((action) => action.alias === 'CONFIGURE_TOTP') ?? {}, body);
      return empty();
    }

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
      const config = {
        id,
        alias: String(body?.alias),
        config: body?.config as Record<string, string>,
      };
      this.configs.set(id, config);
      for (const entries of this.executions.values()) {
        const entry = entries.find((candidate) => candidate.id === executionId);
        if (entry) entry.authenticationConfig = id;
      }
      return empty();
    }

    const configPath = url.pathname.match(new RegExp(`^${base}/authentication/config/([^/]+)$`));
    if (configPath) {
      const id = decodeURIComponent(configPath[1]);
      if (method === 'GET') return json(this.configs.get(id));
      this.configs.set(id, { ...(body as { alias: string; config: Record<string, string> }), id });
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
