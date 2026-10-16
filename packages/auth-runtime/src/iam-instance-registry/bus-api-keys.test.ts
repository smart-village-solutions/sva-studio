/** Exercises the facade using real platform/CSRF/reauth guards and a fake Bus. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ctx: {
    sessionId: 'session',
    freshReauthAt: Date.now(),
    user: {
      id: 'root-user',
      roles: ['instance_registry_admin'],
      instanceId: undefined as string | undefined,
    },
  },
  sessionKind: 'platform',
  authenticated: true,
  instance: { instanceId: 'bb-town', displayName: 'Town', status: 'active' },
  getInstance: vi.fn(),
  audit: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: (request: Request, work: (ctx: typeof state.ctx) => Promise<Response>) =>
    state.authenticated && !request.headers.has('authorization')
      ? work(state.ctx)
      : Response.json({}, { status: 401 }),
}));
vi.mock('../redis-session.js', () => ({
  getSession: async () => ({ auth: { kind: state.sessionKind } }),
}));
vi.mock('./repository.js', () => ({
  withRegistryRepository: (work: (repo: unknown) => unknown) =>
    work({ getInstanceById: state.getInstance, appendAuditEvent: state.audit }),
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-test' }),
  isCanonicalAuthHost: (host: string) => host === 'studio.example.test',
  withRequestContext: (_input: unknown, work: () => unknown) => work(),
  createApiError: (status: number, code: string) => Response.json({ error: { code } }, { status }),
}));
vi.mock('../iam-account-management/shared-actor-resolution.js', () => ({
  requireRoles: (ctx: typeof state.ctx, roles: Set<string>) =>
    ctx.user.roles.some((role) => roles.has(role)) ? null : Response.json({}, { status: 403 }),
}));
vi.mock('../iam-account-management/api-helpers.js', () => ({
  createApiError: (status: number, code: string) => Response.json({ error: { code } }, { status }),
}));
vi.mock('../request-hosts.js', () => ({
  resolveEffectiveRequestHost: (request: Request) => new URL(request.url).host,
}));

import { busApiKeyHandlers } from './bus-api-keys.js';
const request = (
  action: keyof typeof busApiKeyHandlers,
  options: { host?: string; body?: unknown; csrf?: boolean } = {}
) => {
  const path = `/api/v1/iam/instances/bb-town/bus-api-keys${action === 'activate' || action === 'revoke' ? `/key-one/${action}` : ''}`;
  return new Request(`https://${options.host ?? 'studio.example.test'}${path}`, {
    method: action === 'list' ? 'GET' : 'POST',
    headers:
      options.csrf === false
        ? {}
        : { origin: 'https://studio.example.test', 'x-requested-with': 'XMLHttpRequest' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
};
const payload = {
  contact: ' customer@example.test ',
  createdBy: ' dk ',
  validThrough: '2027-12-31',
};
const key = {
  keyId: 'key-one',
  owner: 'Town',
  label: 'bb-town',
  revoked: true,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Bus key facade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    state.ctx = {
      sessionId: 'session',
      freshReauthAt: Date.now(),
      user: { id: 'root-user', roles: ['instance_registry_admin'], instanceId: undefined },
    };
    state.sessionKind = 'platform';
    state.authenticated = true;
    state.instance = { instanceId: 'bb-town', displayName: 'Town', status: 'active' };
    state.getInstance.mockReset().mockImplementation(async () => state.instance);
    state.audit.mockReset().mockResolvedValue(undefined);
    state.fetch.mockReset().mockImplementation(async () => Response.json({ items: [key] }));
    vi.stubGlobal('fetch', state.fetch);
    vi.stubEnv('BUS_API_BASE_URL', 'https://bus.example.test');
    vi.stubEnv('BUS_API_ADMIN_TOKEN', 'test-token');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it.each(['list', 'create', 'revoke', 'activate'] as const)(
    '%s rejects tenant hosts, tenant sessions, absent session and roles before Bus access',
    async (action) => {
      expect(
        (await busApiKeyHandlers[action](request(action, { host: 'tenant.example.test' }))).status
      ).toBe(403);
      state.sessionKind = 'instance';
      expect((await busApiKeyHandlers[action](request(action))).status).toBe(403);
      state.sessionKind = 'platform';
      state.ctx.user.roles = ['system_admin'];
      expect((await busApiKeyHandlers[action](request(action))).status).toBe(403);
      state.authenticated = false;
      const response = await busApiKeyHandlers[action](request(action));
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(state.fetch).not.toHaveBeenCalled();
    }
  );
  it.each(['create', 'revoke', 'activate'] as const)(
    '%s requires CSRF and fresh reauth',
    async (action) => {
      expect((await busApiKeyHandlers[action](request(action, { csrf: false }))).status).toBe(403);
      state.ctx.freshReauthAt = 0;
      expect((await busApiKeyHandlers[action](request(action))).status).toBe(403);
      expect(state.fetch).not.toHaveBeenCalled();
    }
  );
  it('rejects technical bearer credentials', async () => {
    const req = request('list');
    req.headers.set('authorization', 'Bearer service-token');
    expect((await busApiKeyHandlers.list(req)).status).toBe(401);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('requires registry existence', async () => {
    state.getInstance.mockResolvedValue(undefined);
    expect((await busApiKeyHandlers.list(request('list'))).status).toBe(404);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it.each(['suspended', 'archived'])(
    'allows reads and revocation but not creation or activation for %s',
    async (status) => {
      state.instance.status = status;
      expect((await busApiKeyHandlers.list(request('list'))).status).toBe(200);
      state.fetch.mockResolvedValue(Response.json({ ok: true }));
      expect((await busApiKeyHandlers.revoke(request('revoke'))).status).toBe(200);
      state.fetch.mockClear();
      expect((await busApiKeyHandlers.create(request('create', { body: payload }))).status).toBe(
        409
      );
      expect((await busApiKeyHandlers.activate(request('activate'))).status).toBe(409);
      expect(state.fetch).not.toHaveBeenCalled();
    }
  );
  it('derives owner/label from registry, forwards session actor and records no contact or key', async () => {
    state.fetch.mockResolvedValue(Response.json({ keyId: 'new-id', apiKey: 'sk_secret' }));
    const req = request('create', { body: payload });
    req.headers.set('x-admin-actor-id', 'forged');
    const response = await busApiKeyHandlers.create(req);
    expect(response.status).toBe(201);
    expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toEqual({
      owner: 'Town',
      label: 'bb-town',
      contact: 'customer@example.test',
      createdBy: 'dk',
      expiresAt: '2028-01-01T00:00:00.000Z',
    });
    expect(state.fetch.mock.calls[0][1].headers['x-admin-actor-id']).toBe('root-user');
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'root-user',
        instanceId: 'bb-town',
        requestId: 'req-test',
        details: expect.objectContaining({ keyId: 'new-id', result: 'success' }),
      })
    );
    expect(JSON.stringify(state.audit.mock.calls)).not.toMatch(/customer@|sk_secret|test-token/u);
  });
  it.each([
    { ...payload, owner: 'Forged' },
    { ...payload, label: 'foreign' },
    { ...payload, contact: 'bad' },
    { ...payload, createdBy: '' },
    { ...payload, validThrough: '2026-02-30' },
    { ...payload, validThrough: '2025-12-31' },
  ])('rejects invalid or injected create fields', async (body) => {
    expect((await busApiKeyHandlers.create(request('create', { body }))).status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...key, label: 'foreign' },
    { ...key, revoked: false },
    { ...key, expiresAt: '2025-01-01T00:00:00Z' },
  ])('rejects foreign, active and expired activation targets', async (item) => {
    state.fetch.mockResolvedValue(Response.json({ items: [item] }));
    expect((await busApiKeyHandlers.activate(request('activate'))).status).toBe(
      item.label === 'foreign' ? 404 : 409
    );
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it('preserves confirmed create success after audit failure without retry', async () => {
    state.fetch.mockResolvedValue(Response.json({ keyId: 'new-id', apiKey: 'sk_secret' }));
    state.audit.mockRejectedValue(new Error('private database details'));
    const response = await busApiKeyHandlers.create(request('create', { body: payload }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { apiKey: 'sk_secret', auditRecorded: false },
      requestId: 'req-test',
    });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it('reports an ambiguous write without repeating it', async () => {
    state.fetch.mockRejectedValue(new Error('secret downstream message'));
    const response = await busApiKeyHandlers.create(request('create', { body: payload }));
    expect(await response.json()).toMatchObject({ error: { code: 'bus_outcome_unknown' } });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
});
