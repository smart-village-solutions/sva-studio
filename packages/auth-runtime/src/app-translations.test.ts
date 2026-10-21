import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  ctx: {
    sessionId: 'session',
    activeOrganizationId: '11111111-1111-4111-8111-111111111111' as string | undefined,
    user: { id: 'user', instanceId: 'tenant' as string | undefined, roles: [] as string[] },
  },
  session: {
    userId: 'user',
    activeOrganizationId: '11111111-1111-4111-8111-111111111111',
    auth: { kind: 'instance', instanceId: 'tenant' },
  },
  allowed: false,
  platformError: null as Response | null,
  csrfError: null as Response | null,
  repo: {
    readEffective: vi.fn(),
    seal: vi.fn(),
    importManifest: vi.fn(),
    createMunicipalDraft: vi.fn(),
  },
  db: vi.fn(),
  permissions: vi.fn(),
  createRepo: vi.fn(),
  pluginAccess: vi.fn(),
}));
vi.mock('./middleware.js', () => ({
  withAuthenticatedUser: (_request: Request, work: (ctx: unknown) => unknown) => work(state.ctx),
}));
vi.mock('./redis-session.js', () => ({ getSession: () => state.session }));
vi.mock('./shared/request-security.js', () => ({ validateCsrf: () => state.csrfError }));
vi.mock('./iam-instance-registry/http.js', () => ({
  ensurePlatformAccess: () => state.platformError,
}));
vi.mock('./iam-authorization/permission-store.js', () => ({
  resolveEffectivePermissions: (...args: unknown[]) => state.permissions(...args),
}));
vi.mock('@sva/data-repositories/server', () => ({
  createAppTranslationRepository: (...args: unknown[]) => state.createRepo(...args),
}));
vi.mock('./plugin-tenant-lifecycle/access.js', () => ({
  readConfiguredPluginTenantAccess: (...args: unknown[]) => state.pluginAccess(...args),
}));
vi.mock('./db.js', () => ({ withIamAppDb: (...args: unknown[]) => state.db(...args) }));
import {
  executeAppTranslationOperation,
  readAppTranslationsLocalReadiness,
} from './app-translations.js';
const request = new Request('https://tenant.test/internal', { method: 'POST' });
describe('internal catalog session facade', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    state.allowed = false;
    state.pluginAccess.mockResolvedValue({ allowed: true, reason: 'ready' });
    state.platformError = null;
    state.csrfError = null;
    state.ctx.user.instanceId = 'tenant';
    state.ctx.activeOrganizationId = '11111111-1111-4111-8111-111111111111';
    state.session = {
      userId: 'user',
      activeOrganizationId: state.ctx.activeOrganizationId,
      auth: { kind: 'instance', instanceId: 'tenant' },
    };
    state.permissions.mockImplementation(async () => ({
      ok: true,
      permissions: state.allowed
        ? ['app-translations.catalog.read', 'app-translations.catalog.publish'].map((action) => ({
            action,
            resourceType: 'app-translations',
            organizationId: state.ctx.activeOrganizationId,
          }))
        : [],
    }));
    state.createRepo.mockResolvedValue(state.repo);
    state.db.mockImplementation(async (work) =>
      work({ query: async () => ({ rows: [{ id: 'org' }] }) })
    );
    state.repo.readEffective.mockResolvedValue({ draft: {} });
    state.repo.seal.mockResolvedValue({ state: 'sealed' });
  });
  it('denies missing actions, tenant import and manipulated scope before DB access', async () => {
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(403);
    expect(state.db).not.toHaveBeenCalled();
    expect(
      (
        await executeAppTranslationOperation(request, {
          operation: 'import',
          manifest: {},
          expectedRevision: '0',
          locales: ['de'],
        })
      ).status
    ).toBe(403);
    expect(
      (
        await executeAppTranslationOperation(request, {
          operation: 'read',
          contractId: 'ui',
          organizationId: 'other',
        })
      ).status
    ).toBe(400);
    expect(state.db).not.toHaveBeenCalled();
  });
  it('uses only the active stored organization and rejects session mismatch', async () => {
    state.allowed = true;
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(200);
    expect(state.createRepo.mock.calls[0]?.[1]).toEqual({
      kind: 'municipal',
      instanceId: 'tenant',
      organizationId: state.ctx.activeOrganizationId,
    });
    state.session.activeOrganizationId = '22222222-2222-4222-8222-222222222222';
    state.db.mockClear();
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(403);
    expect(state.db).not.toHaveBeenCalled();
  });
  it('requires publish action and CSRF for local sealing, fails closed on permission outage', async () => {
    const op = { operation: 'seal', contractId: 'ui', expectedRevision: '1' };
    expect((await executeAppTranslationOperation(request, op)).status).toBe(403);
    state.allowed = true;
    state.csrfError = new Response(null, { status: 403 });
    expect((await executeAppTranslationOperation(request, op)).status).toBe(403);
    expect(state.repo.seal).not.toHaveBeenCalled();
    state.csrfError = null;
    state.permissions.mockResolvedValue({ ok: false });
    expect((await executeAppTranslationOperation(request, op)).status).toBe(503);
    expect(state.db).not.toHaveBeenCalled();
  });
  it('cannot turn a tenant session into platform scope', async () => {
    state.ctx.user.instanceId = undefined;
    expect(
      (
        await executeAppTranslationOperation(request, {
          operation: 'import',
          manifest: {},
          expectedRevision: '0',
          locales: ['de'],
        })
      ).status
    ).toBe(403);
    expect(state.repo.importManifest).not.toHaveBeenCalled();
  });
  it('distinguishes actual read and publish permissions and rejects mutating GET calls', async () => {
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-translations.catalog.read',
          resourceType: 'app-translations',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(200);
    expect(
      (
        await executeAppTranslationOperation(request, {
          operation: 'seal',
          contractId: 'ui',
          expectedRevision: '1',
        })
      ).status
    ).toBe(403);
    expect(
      (
        await executeAppTranslationOperation(new Request('https://tenant.test/internal'), {
          operation: 'seal',
          contractId: 'ui',
          expectedRevision: '1',
        })
      ).status
    ).toBe(405);
    expect(state.repo.seal).not.toHaveBeenCalled();
  });
  it.each([
    {
      action: 'app-translations.catalog.read',
      legacyAction: 'app-translations.catalogRead',
      operation: { operation: 'read', contractId: 'ui' },
    },
    {
      action: 'app-translations.catalog.write',
      legacyAction: 'app-translations.catalogWrite',
      operation: {
        operation: 'createMunicipal',
        baseReleaseId: '33333333-3333-4333-8333-333333333333',
        locales: ['de'],
      },
    },
    {
      action: 'app-translations.catalog.publish',
      legacyAction: 'app-translations.catalogPublish',
      operation: { operation: 'seal', contractId: 'ui', expectedRevision: '1' },
    },
  ])(
    'authorizes only the exact hierarchical action $action',
    async ({ action, legacyAction, operation }) => {
      const permission = {
        resourceType: 'app-translations',
        organizationId: state.ctx.activeOrganizationId,
      };
      state.permissions.mockResolvedValue({ ok: true, permissions: [{ ...permission, action }] });
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(200);
      state.db.mockClear();
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: [{ ...permission, action: legacyAction }],
      });
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(403);
      expect(state.db).not.toHaveBeenCalled();
    }
  );
  it.each(['inactive', 'suspended', 'pending', 'blocked', 'evidence_invalid'])(
    'denies %s plugin access despite valid catalog grants before repository access',
    async (reason) => {
      state.allowed = true;
      state.pluginAccess.mockResolvedValue({ allowed: false, reason });
      expect(
        (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
          .status
      ).toBe(403);
      expect(state.pluginAccess).toHaveBeenCalledWith('tenant', 'app-translations');
      expect(state.db).not.toHaveBeenCalled();
    }
  );
  it('fails closed when plugin evidence cannot be loaded', async () => {
    state.allowed = true;
    state.pluginAccess.mockRejectedValue(new Error('registry_unavailable'));
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(503);
    expect(state.db).not.toHaveBeenCalled();
  });
  it('exposes only scoped local schema and credential markers, including rotation', async () => {
    const query = vi.fn(async () => ({ rows: [{ ready: true }] }));
    state.db.mockImplementation(async (work) => work({ query }));
    vi.stubEnv('APP_TRANSLATIONS_DEEPL_API_KEY', 'private-first');
    expect(await readAppTranslationsLocalReadiness('tenant-a')).toEqual({
      schemaReady: true,
      providerConfigured: true,
    });
    expect(query.mock.calls[0]).toEqual([
      "SELECT set_config('app.instance_id', $1, true)",
      ['tenant-a'],
    ]);
    vi.stubEnv('APP_TRANSLATIONS_DEEPL_API_KEY', 'private-rotated');
    const status = await readAppTranslationsLocalReadiness('tenant-b');
    expect(status).toEqual({ schemaReady: true, providerConfigured: true });
    expect(JSON.stringify(status)).not.toContain('private');
    query.mockResolvedValue({ rows: [{ ready: false }] });
    expect((await readAppTranslationsLocalReadiness('tenant-b')).schemaReady).toBe(false);
    state.db.mockRejectedValue(new Error('database_unavailable'));
    await expect(readAppTranslationsLocalReadiness('tenant-a')).rejects.toThrow(
      'database_unavailable'
    );
  });
  it('requires the platform guard for global imports and does not trust a tenant role alone', async () => {
    state.ctx.user.instanceId = undefined;
    state.session.auth.kind = 'platform';
    state.platformError = new Response(null, { status: 403 });
    const op = { operation: 'import', manifest: {}, expectedRevision: '0', locales: ['de'] };
    expect((await executeAppTranslationOperation(request, op)).status).toBe(403);
    expect(state.db).not.toHaveBeenCalled();
    state.platformError = null;
    state.repo.importManifest.mockResolvedValue({ draftRevision: '1' });
    expect((await executeAppTranslationOperation(request, op)).status).toBe(200);
    expect(state.createRepo.mock.calls[0]?.[1]).toEqual({ kind: 'global' });
    expect(state.pluginAccess).not.toHaveBeenCalled();
  });
});
