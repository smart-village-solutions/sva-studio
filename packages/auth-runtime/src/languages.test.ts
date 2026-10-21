import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTranslationError } from '@sva/core';
const state = vi.hoisted(() => ({
  ctx: { sessionId: 'session', user: { id: 'root', instanceId: undefined as string | undefined } },
  session: { userId: 'root', auth: { kind: 'platform' } },
  platformError: null as Response | null,
  csrfError: null as Response | null,
  allowed: false,
  db: vi.fn(),
  list: vi.fn(),
  assignments: vi.fn(),
  setAvailable: vi.fn(),
  setInstance: vi.fn(),
}));
vi.mock('./middleware.js', () => ({
  withAuthenticatedUser: (_r: Request, work: (ctx: unknown) => unknown) => work(state.ctx),
}));
vi.mock('./redis-session.js', () => ({ getSession: () => state.session }));
vi.mock('./iam-instance-registry/http.js', () => ({
  ensurePlatformAccess: () => state.platformError,
}));
vi.mock('./shared/request-security.js', () => ({ validateCsrf: () => state.csrfError }));
vi.mock('./app-translations.js', () => ({
  readBoundedCatalogBody: async (request: Request) => ({ ok: true, data: await request.json() }),
}));
vi.mock('./plugin-tenant-lifecycle/access.js', () => ({
  readConfiguredPluginTenantAccess: async () => ({ allowed: state.allowed }),
}));
vi.mock('./db.js', () => ({ withIamAppDb: (...args: unknown[]) => state.db(...args) }));
vi.mock('@sva/data-repositories/server', () => ({
  createLanguageRepository: () => ({
    list: state.list,
    assignments: state.assignments,
    setAvailable: state.setAvailable,
    setInstance: state.setInstance,
  }),
}));
import { languagesHandler } from './languages.js';
const get = (query = '') => new Request(`https://studio.test/api/v1/iam/languages${query}`);
const post = (data: unknown) => new Request(get(), { method: 'POST', body: JSON.stringify(data) });
describe('Root language configuration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.ctx.user.instanceId = undefined;
    state.session = { userId: 'root', auth: { kind: 'platform' } };
    state.platformError = null;
    state.csrfError = null;
    state.allowed = false;
    state.list.mockResolvedValue([{ locale: 'de', available: true, revision: '1' }]);
    state.assignments.mockResolvedValue([]);
    state.db.mockImplementation(async (work) => work({ query: vi.fn() }));
  });
  it('lists central languages without silently selecting an instance', async () => {
    const response = await languagesHandler(get());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      instanceId: null,
      moduleAllowed: false,
      assignments: [],
    });
    expect(state.assignments).not.toHaveBeenCalled();
  });
  it('rejects tenant sessions, stale users and insufficient Root access before database access', async () => {
    state.ctx.user.instanceId = 'tenant';
    expect((await languagesHandler(get())).status).toBe(403);
    state.ctx.user.instanceId = undefined;
    state.session.userId = 'other';
    expect((await languagesHandler(get())).status).toBe(403);
    state.session.userId = 'root';
    state.platformError = new Response(null, { status: 403 });
    expect((await languagesHandler(get())).status).toBe(403);
    expect(state.db).not.toHaveBeenCalled();
  });
  it('requires CSRF and validates codes/revisions before writes', async () => {
    const input = {
      operation: 'availability',
      locale: 'en',
      available: false,
      expectedRevision: '1',
    };
    state.csrfError = new Response(null, { status: 403 });
    expect((await languagesHandler(post(input))).status).toBe(403);
    state.csrfError = null;
    expect((await languagesHandler(post({ ...input, locale: 'xx' }))).status).toBe(400);
    expect((await languagesHandler(post({ ...input, expectedRevision: '-1' }))).status).toBe(400);
    expect(state.setAvailable).not.toHaveBeenCalled();
  });
  it('blocks activation without a ready module but permits removing an existing assignment', async () => {
    const input = {
      operation: 'assignment',
      instanceId: 'tenant',
      locale: 'en',
      enabled: true,
      expectedRevision: '1',
    };
    expect((await languagesHandler(post(input))).status).toBe(403);
    expect(state.setInstance).not.toHaveBeenCalled();
    expect((await languagesHandler(post({ ...input, enabled: false }))).status).toBe(200);
    expect(state.setInstance).toHaveBeenCalledWith('tenant', 'en', false, '1');
    state.allowed = true;
    expect((await languagesHandler(post(input))).status).toBe(200);
  });
  it('preserves the expected revision and exposes conflicts without overwriting', async () => {
    state.setAvailable.mockRejectedValue(new AppTranslationError('catalog_conflict'));
    expect(
      (
        await languagesHandler(
          post({ operation: 'availability', locale: 'en', available: false, expectedRevision: '7' })
        )
      ).status
    ).toBe(409);
    expect(state.setAvailable).toHaveBeenCalledWith('en', false, '7');
  });
});
