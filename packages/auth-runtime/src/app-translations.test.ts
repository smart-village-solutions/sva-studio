import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTranslationError } from '@sva/core';
import * as catalogJobs from './app-translations-jobs.js';
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
  providerReady: true,
  locales: ['de', 'en'] as string[],
  platformError: null as Response | null,
  csrfError: null as Response | null,
  repo: {
    overview: vi.fn(),
    loadDraft: vi.fn(),
    loadRelease: vi.fn(),
    exportTexts: vi.fn(),
    editText: vi.fn(),
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
vi.mock('./iam-authorization/permission-store.queries.js', () => ({
  loadPermissionsWithClient: vi.fn(),
}));
vi.mock('@sva/data-repositories/server', () => ({
  createAppTranslationRepository: (...args: unknown[]) => state.createRepo(...args),
}));
vi.mock('./plugin-tenant-lifecycle/access.js', () => ({
  readConfiguredPluginTenantAccess: (...args: unknown[]) => state.pluginAccess(...args),
}));
vi.mock('./app-translations-deepl.js', () => ({
  getDeepLSetupStatus: () => ({
    ready: state.providerReady,
    reason: state.providerReady ? 'ready' : 'check_required',
    interfaceId: 'deepl',
    selectedLocales: state.locales.filter((locale) => locale !== 'de'),
  }),
  readDeepLSetupStatus: async () => ({ ready: state.providerReady }),
}));
vi.mock('./db.js', () => ({ withIamAppDb: (...args: unknown[]) => state.db(...args) }));
import {
  executeAppTranslationOperation,
  appTranslationCatalogHandler,
  readAppTranslationsLocalReadiness,
} from './app-translations.js';
const request = new Request('https://tenant.test/internal', { method: 'POST' });
describe('internal catalog session facade', () => {
  it('starts translations only with write permission, CSRF, matching scope and a strict payload', async () => {
    const start = vi
      .spyOn(catalogJobs, 'startCatalogTranslation')
      .mockResolvedValue({ id: 'job', status: 'queued', progress: undefined, error: undefined });
    const operation = {
      operation: 'translate',
      contractId: 'ui',
      expectedRevision: '1',
      mode: 'missing',
    };
    try {
      state.allowed = true;
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(403);
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: [
          {
            action: 'app-translations.catalog.write',
            resourceType: 'app-translations',
            organizationId: state.ctx.activeOrganizationId,
          },
        ],
      });
      state.csrfError = new Response(null, { status: 403 });
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(403);
      state.csrfError = null;
      expect(
        (
          await executeAppTranslationOperation(
            new Request(request, { headers: { 'X-SVA-Catalog-Scope': 'wrong' } }),
            operation
          )
        ).status
      ).toBe(409);
      expect(
        (
          await executeAppTranslationOperation(
            new Request(request, { headers: { 'X-SVA-Catalog-Mode': 'source' } }),
            operation
          )
        ).status
      ).toBe(403);
      expect(
        (await executeAppTranslationOperation(request, { ...operation, url: 'https://other.test' }))
          .status
      ).toBe(400);
      expect(start).not.toHaveBeenCalled();
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(200);
      expect(start).toHaveBeenCalledWith(
        expect.anything(),
        { kind: 'municipal', instanceId: 'tenant', organizationId: state.ctx.activeOrganizationId },
        'user',
        operation
      );
    } finally {
      start.mockRestore();
    }
  });
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    state.allowed = false;
    state.providerReady = true;
    state.locales = ['de', 'en'];
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
      work({
        query: async (sql: string) => ({
          rows: sql.includes('instance_external_interfaces')
            ? [
                {
                  id: 'deepl',
                  publicConfig: {
                    revision: 'r1',
                    credentialRevision: 'k1',
                    plan: 'pro',
                    englishVariant: 'en-GB',
                    selectedLocales: state.locales.filter((locale) => locale !== 'de'),
                    availableLanguages: state.locales
                      .filter((locale) => locale !== 'de')
                      .map((locale) => ({
                        code: locale === 'en' ? 'en-GB' : locale,
                        name: locale,
                        tagHandling: false,
                      })),
                  },
                },
              ]
            : [{ id: 'org' }],
        }),
      })
    );
    state.repo.loadDraft.mockResolvedValue({ supportedLocales: ['de'] });
    state.repo.editText.mockResolvedValue({
      supportedLocales: ['de', 'en'],
      valuesByLocale: { de: {}, en: {} },
    });
    state.repo.readEffective.mockResolvedValue({
      draft: {
        supportedLocales: ['de', 'en'],
        valuesByLocale: { de: {}, en: { secret: 'foreign' } },
      },
      values: { de: {}, en: { secret: 'foreign' } },
      baseCatalogs: { de: {}, en: { secret: 'foreign' } },
    });
    state.repo.seal.mockResolvedValue({ state: 'sealed', supportedLocales: ['de'] });
    state.repo.createMunicipalDraft.mockResolvedValue({
      supportedLocales: ['de'],
      valuesByLocale: { de: {} },
    });
  });
  it('keeps the German editor restricted without requiring the multilingual module', async () => {
    const sourceRequest = new Request(request, { headers: { 'X-SVA-Catalog-Mode': 'source' } });
    state.pluginAccess.mockResolvedValue({ allowed: false });
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-texts.catalog.read',
          resourceType: 'app-texts',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    const response = await executeAppTranslationOperation(sourceRequest, {
      operation: 'read',
      contractId: 'ui',
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('foreign');
    expect(state.pluginAccess).not.toHaveBeenCalled();
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(403);
  });
  it.each(['source', 'translations'])(
    'lists and previews all scoped immutable snapshots in %s mode without enabling foreign edits',
    async (mode) => {
      const namespace = mode === 'source' ? 'app-texts' : 'app-translations';
      state.allowed = true;
      state.locales = ['de'];
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: [
          {
            action: `${namespace}.catalog.read`,
            resourceType: namespace,
            organizationId: state.ctx.activeOrganizationId,
          },
        ],
      });
      const catalogRequest = new Request(request, { headers: { 'X-SVA-Catalog-Mode': mode } });
      const release = {
        id: '33333333-3333-4333-8333-333333333333',
        state: 'sealed',
        contractId: 'ui',
        supportedLocales: ['de', 'en', 'fr', 'pt-PT'],
        catalogSetRevision: '2',
        draftRevision: '97',
        catalogs: { de: { values: { title: 'Titel' } }, en: { values: { title: 'Title' } } },
      };
      state.repo.overview.mockResolvedValue({
        catalogs: [{ supportedLocales: ['de', 'en'] }],
        releases: [release],
        bases: [],
      });
      state.repo.loadRelease.mockResolvedValue(release);
      const overview = await executeAppTranslationOperation(catalogRequest, {
        operation: 'overview',
      });
      expect(overview.status).toBe(200);
      expect((await overview.json()).data.releases).toEqual([release]);
      const preview = await executeAppTranslationOperation(catalogRequest, {
        operation: 'readRelease',
        releaseId: release.id,
      });
      expect(preview.status).toBe(200);
      expect((await preview.json()).data).toEqual(release);
      expect(
        (
          await executeAppTranslationOperation(catalogRequest, {
            operation: 'edit',
            contractId: 'ui',
            expectedRevision: '98',
            locale: 'en',
            key: 'title',
            value: 'New',
          })
        ).status
      ).toBe(403);
      expect(state.repo.editText).not.toHaveBeenCalled();
    }
  );
  it('rejects foreign language edits in source mode and requires independent host rights for German writes', async () => {
    const sourceRequest = new Request(request, { headers: { 'X-SVA-Catalog-Mode': 'source' } });
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-texts.catalog.write',
          resourceType: 'app-texts',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    state.repo.editText.mockResolvedValue({ valuesByLocale: { de: {} }, supportedLocales: ['de'] });
    const op = {
      operation: 'edit',
      contractId: 'ui',
      expectedRevision: '1',
      locale: 'de',
      key: 'title',
      value: 'Neu',
    };
    expect((await executeAppTranslationOperation(sourceRequest, op)).status).toBe(200);
    expect(state.pluginAccess).not.toHaveBeenCalled();
    expect(
      (await executeAppTranslationOperation(sourceRequest, { ...op, locale: 'en' })).status
    ).toBe(403);
    expect((await executeAppTranslationOperation(request, op)).status).toBe(403);
  });
  it('authorizes additional canonical languages only while selected for this instance', async () => {
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-translations.catalog.write',
          resourceType: 'app-translations',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    state.locales = ['de', 'ar', 'fr-CA'];
    const operation = {
      operation: 'edit',
      contractId: 'ui',
      expectedRevision: '1',
      locale: 'fr-CA',
      key: 'title',
      value: 'Titre',
    };
    state.repo.editText.mockResolvedValue({
      supportedLocales: ['de', 'fr-CA'],
      valuesByLocale: {},
    });
    expect((await executeAppTranslationOperation(request, operation)).status).toBe(200);
    expect(
      (await executeAppTranslationOperation(request, { ...operation, locale: 'pt-BR' })).status
    ).toBe(403);
    expect(
      (await executeAppTranslationOperation(request, { ...operation, locale: '../bad' })).status
    ).toBe(400);
  });
  it('cannot change the German base through plugin-only write rights', async () => {
    state.allowed = true;
    for (const operation of ['createMunicipal', 'changeBase']) {
      const input = {
        operation,
        baseReleaseId: '33333333-3333-4333-8333-333333333333',
        locales: ['de'],
        ...(operation === 'changeBase' ? { contractId: 'ui', expectedRevision: '1' } : {}),
      };
      expect((await executeAppTranslationOperation(request, input)).status).toBe(403);
    }
    expect(state.db).not.toHaveBeenCalled();
  });
  it('seals German with host publish rights while the module is unavailable', async () => {
    const sourceRequest = new Request(request, { headers: { 'X-SVA-Catalog-Mode': 'source' } });
    state.pluginAccess.mockResolvedValue({ allowed: false });
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-texts.catalog.publish',
          resourceType: 'app-texts',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    expect(
      (
        await executeAppTranslationOperation(sourceRequest, {
          operation: 'seal',
          contractId: 'ui',
          expectedRevision: '1',
        })
      ).status
    ).toBe(200);
    expect(state.repo.seal).toHaveBeenCalledWith('ui', '1', true, {});
    expect(state.pluginAccess).not.toHaveBeenCalled();
  });
  it('hides disabled translations and denies their modification while retaining storage', async () => {
    state.allowed = true;
    state.locales = ['de'];
    const result = await executeAppTranslationOperation(request, {
      operation: 'read',
      contractId: 'ui',
    });
    expect(result.status).toBe(200);
    expect(JSON.stringify(await result.json())).not.toContain('foreign');
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        {
          action: 'app-translations.catalog.write',
          resourceType: 'app-translations',
          organizationId: state.ctx.activeOrganizationId,
        },
      ],
    });
    expect(
      (
        await executeAppTranslationOperation(request, {
          operation: 'edit',
          contractId: 'ui',
          expectedRevision: '1',
          locale: 'en',
          key: 'title',
          value: 'Title',
        })
      ).status
    ).toBe(403);
    expect(state.repo.editText).not.toHaveBeenCalled();
  });
  it('protects UI reads and bounds JSON input before dispatching mutations', async () => {
    const get = new Request('https://tenant.test/api/v1/iam/app-translations');
    expect((await appTranslationCatalogHandler(get)).status).toBe(403);
    state.allowed = true;
    state.repo.overview.mockResolvedValue({ catalogs: [], releases: [], bases: [] });
    expect((await appTranslationCatalogHandler(get)).status).toBe(200);
    expect(state.repo.overview).toHaveBeenCalledOnce();
    expect(
      (
        await executeAppTranslationOperation(
          new Request(get.url, { headers: { 'X-SVA-Catalog-Scope': 'wrong' } }),
          { operation: 'overview' }
        )
      ).status
    ).toBe(409);
    expect(
      (await appTranslationCatalogHandler(new Request(get.url + '?operation=seal'))).status
    ).toBe(405);
    expect(
      (await appTranslationCatalogHandler(new Request(get.url + '?organizationId=other'))).status
    ).toBe(400);
    state.csrfError = new Response(null, { status: 403 });
    expect(
      (
        await appTranslationCatalogHandler(
          new Request(get.url, {
            method: 'POST',
            headers: { 'X-SVA-Catalog-Scope': 'global' },
            body: '{}',
          })
        )
      ).status
    ).toBe(403);
    state.csrfError = null;
    expect(
      (
        await appTranslationCatalogHandler(
          new Request(get.url, {
            method: 'POST',
            headers: { 'X-SVA-Catalog-Scope': 'global' },
            body: '{broken',
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await appTranslationCatalogHandler(
          new Request(get.url, {
            method: 'POST',
            headers: { 'X-SVA-Catalog-Scope': 'global' },
            body: 'x'.repeat(1048577),
          })
        )
      ).status
    ).toBe(413);
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
  it.each(['source', 'translations'])(
    'binds the tenant before checking organization RLS in %s mode',
    async (mode) => {
      const namespace = mode === 'source' ? 'app-texts' : 'app-translations';
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: [
          {
            action: `${namespace}.catalog.read`,
            resourceType: namespace,
            organizationId: state.ctx.activeOrganizationId,
          },
        ],
      });
      const queries: string[] = [];
      state.db.mockImplementation(async (work) => {
        let tenant: unknown;
        return work({
          query: async (sql: string, values: unknown[]) => {
            queries.push(sql);
            if (sql.includes("set_config('app.instance_id'")) tenant = values[0];
            return {
              rows:
                sql.includes('FROM iam.organizations') && tenant === 'tenant'
                  ? [{ id: 'org' }]
                  : [],
            };
          },
        });
      });
      const result = await executeAppTranslationOperation(
        new Request(request, { headers: { 'X-SVA-Catalog-Mode': mode } }),
        { operation: 'read', contractId: 'ui' }
      );
      expect(result.status).toBe(200);
      expect(queries[0]).toContain("set_config('app.instance_id'");
      expect(queries[1]).toContain('FROM iam.organizations');
    }
  );
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
        operation: 'edit',
        contractId: 'ui',
        expectedRevision: '1',
        locale: 'en',
        key: 'title',
        value: 'Title',
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
    state.providerReady = false;
    const status = await readAppTranslationsLocalReadiness('tenant-b');
    expect(status).toEqual({ schemaReady: true, providerConfigured: false });
    expect(JSON.stringify(status)).not.toContain('private');
    query.mockResolvedValue({ rows: [{ ready: false }] });
    expect((await readAppTranslationsLocalReadiness('tenant-b')).schemaReady).toBe(false);
    state.db.mockRejectedValue(new Error('database_unavailable'));
    await expect(readAppTranslationsLocalReadiness('tenant-a')).rejects.toThrow(
      'database_unavailable'
    );
  });
  it('keeps existing translations readable but blocks new dependent mutations without provider readiness', async () => {
    state.allowed = true;
    state.providerReady = false;
    expect(
      (await executeAppTranslationOperation(request, { operation: 'read', contractId: 'ui' }))
        .status
    ).toBe(200);
    const result = await executeAppTranslationOperation(request, {
      operation: 'seal',
      contractId: 'ui',
      expectedRevision: '1',
    });
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: 'catalog_setup_required' });
    expect(state.repo.seal).not.toHaveBeenCalled();
  });
  it('requires the platform guard for global imports and does not trust a tenant role alone', async () => {
    state.ctx.user.instanceId = undefined;
    state.session.auth.kind = 'platform';
    state.platformError = new Response(null, { status: 403 });
    const request = new Request('https://root.test/internal', {
      method: 'POST',
      headers: { 'X-SVA-Catalog-Mode': 'source' },
    });
    const op = { operation: 'import', manifest: {}, expectedRevision: '0', locales: ['de'] };
    expect((await executeAppTranslationOperation(request, op)).status).toBe(403);
    expect(state.db).not.toHaveBeenCalled();
    state.platformError = null;
    state.repo.importManifest.mockResolvedValue({
      draftRevision: '1',
      supportedLocales: ['de'],
      valuesByLocale: { de: {} },
    });
    expect((await executeAppTranslationOperation(request, op)).status).toBe(200);
    expect(state.createRepo.mock.calls[0]?.[1]).toEqual({ kind: 'global' });
    expect(state.pluginAccess).not.toHaveBeenCalled();
  });
  describe('texts.js snapshot download', () => {
    it.each(['source', 'translations'])(
      'returns an authenticated attachment in %s mode without mutations or provider readiness',
      async (mode) => {
        state.allowed = true;
        state.providerReady = false;
        const namespace = mode === 'source' ? 'app-texts' : 'app-translations';
        state.permissions.mockResolvedValue({
          ok: true,
          permissions: [
            {
              action: `${namespace}.catalog.read`,
              resourceType: namespace,
              organizationId: state.ctx.activeOrganizationId,
            },
          ],
        });
        state.repo.exportTexts.mockResolvedValue('export const texts = {};');
        const response = await appTranslationCatalogHandler(
          new Request(
            'https://studio.test/api/v1/iam/app-translations?operation=downloadTexts&releaseId=22222222-2222-4222-8222-222222222222',
            {
              headers: { 'X-SVA-Catalog-Mode': mode },
            }
          )
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
        expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="texts.js"');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(await response.text()).toBe('export const texts = {};');
        expect(state.repo.exportTexts).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
        expect(state.repo.editText).not.toHaveBeenCalled();
        expect(state.repo.seal).not.toHaveBeenCalled();
      }
    );
    it.each(['catalog_not_found', 'catalog_export_incompatible'] as const)(
      'returns a safe error instead of an attachment for %s',
      async (code) => {
        state.allowed = true;
        state.repo.exportTexts.mockRejectedValue(new AppTranslationError(code));
        const response = await appTranslationCatalogHandler(
          new Request(
            'https://studio.test/api/v1/iam/app-translations?operation=downloadTexts&releaseId=22222222-2222-4222-8222-222222222222'
          )
        );
        expect(response.status).toBe(code === 'catalog_not_found' ? 404 : 400);
        expect(response.headers.has('Content-Disposition')).toBe(false);
        expect(await response.json()).toEqual({ error: code });
      }
    );
    it.each(['source', 'translations'])(
      'supports native %s download links with the same read permissions',
      async (mode) => {
        state.allowed = true;
        state.providerReady = false;
        const namespace = mode === 'source' ? 'app-texts' : 'app-translations';
        state.permissions.mockResolvedValue({
          ok: true,
          permissions: [
            {
              action: `${namespace}.catalog.read`,
              resourceType: namespace,
              organizationId: state.ctx.activeOrganizationId,
            },
          ],
        });
        state.repo.exportTexts.mockResolvedValue('export let texts = {};');
        const url = `https://studio.test/api/v1/iam/app-translations?operation=downloadTexts&releaseId=22222222-2222-4222-8222-222222222222&mode=${mode}`;
        expect((await appTranslationCatalogHandler(new Request(url))).status).toBe(200);
        if (mode === 'source') expect(state.pluginAccess).not.toHaveBeenCalled();
        state.repo.exportTexts.mockClear();
        expect(
          (
            await appTranslationCatalogHandler(
              new Request(url.replace(`mode=${mode}`, 'mode=invalid'))
            )
          ).status
        ).toBe(400);
        expect(
          (
            await appTranslationCatalogHandler(
              new Request(url, {
                headers: { 'X-SVA-Catalog-Mode': mode === 'source' ? 'translations' : 'source' },
              })
            )
          ).status
        ).toBe(400);
        state.permissions.mockResolvedValue({ ok: true, permissions: [] });
        expect((await appTranslationCatalogHandler(new Request(url))).status).toBe(403);
        expect(state.repo.exportTexts).not.toHaveBeenCalled();
      }
    );
    it('rejects missing permission, malformed ids and stale organization bindings before export', async () => {
      const operation = {
        operation: 'downloadTexts',
        releaseId: '22222222-2222-4222-8222-222222222222',
      };
      const request = new Request('https://studio.test/api/v1/iam/app-translations', {
        headers: { 'X-SVA-Catalog-Mode': 'source' },
      });
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(403);
      state.allowed = true;
      expect(
        (await executeAppTranslationOperation(request, { ...operation, releaseId: '../bad' }))
          .status
      ).toBe(400);
      state.session.activeOrganizationId = 'foreign';
      expect((await executeAppTranslationOperation(request, operation)).status).toBe(403);
      expect(state.repo.exportTexts).not.toHaveBeenCalled();
    });
  });
});
