import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';
const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const registerPluginTranslationResolverMock = vi.hoisted(() => vi.fn());
const mergeI18nResourcesMock = vi.hoisted(() => vi.fn());
const resetTranslatorCacheMock = vi.hoisted(() => vi.fn());
const translateMock = vi.hoisted(() => vi.fn((key: string) => key));

vi.mock('@sva/plugin-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/plugin-sdk')>();
  return {
    ...actual,
    registerPluginTranslationResolver: registerPluginTranslationResolverMock,
  };
});

vi.mock('@sva/monitoring-client/logging', () => {
  return {
    createBrowserLogger: () => browserLoggerMock,
  };
});

vi.mock('../../../../packages/plugin-news/src/index.ts', () => ({
  pluginNews: {
    id: 'news',
    displayName: 'News',
    routes: [],
    navigation: [
      {
        id: 'news.navigation',
        to: '/admin/news',
        titleKey: 'news.navigation.title',
        section: 'dataManagement',
        requiredAction: 'news.read',
      },
    ],
    adminResources: [
      {
        resourceId: 'news.content',
        basePath: 'news',
        titleKey: 'news.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ],
    actions: [
      {
        id: 'news.create',
        titleKey: 'news.actions.create',
        requiredAction: 'news.create',
        legacyAliases: ['create'],
      },
    ],
    contentTypes: [{ contentType: 'news.article', displayName: 'News' }],
    permissions: [
      { id: 'news.read', titleKey: 'news.permissions.read' },
      { id: 'news.create', titleKey: 'news.permissions.create' },
    ],
    translations: {},
  },
}));

vi.mock('../../../../packages/plugin-events/src/index.ts', () => ({
  pluginEvents: {
    id: 'events',
    displayName: 'Events',
    routes: [],
    actions: [],
    adminResources: [
      {
        resourceId: 'events.content',
        basePath: 'events',
        titleKey: 'events.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ],
    contentTypes: [{ contentType: 'events.event-record', displayName: 'Events' }],
    translations: {},
  },
}));

vi.mock('../../../../packages/plugin-poi/src/index.ts', () => ({
  pluginPoi: {
    id: 'poi',
    displayName: 'POI',
    routes: [],
    actions: [],
    adminResources: [
      {
        resourceId: 'poi.content',
        basePath: 'poi',
        titleKey: 'poi.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ],
    contentTypes: [{ contentType: 'poi.point-of-interest', displayName: 'POI' }],
    translations: {},
  },
}));

vi.mock('../../../../packages/plugin-waste-management/src/index.ts', () => ({
  pluginWasteManagement: {
    id: 'waste-management',
    displayName: 'Waste Management',
    routes: [
      {
        id: 'waste-management.home',
        path: '/plugins/waste-management',
        guard: 'waste-management.read',
        validateSearch: (search: Record<string, unknown>) => ({
          tab: search.tab === 'settings' ? 'settings' : 'overview',
        }),
        component: () => null,
      },
    ],
    navigation: [
      {
        id: 'waste-management.navigation',
        to: '/plugins/waste-management',
        titleKey: 'wasteManagement.navigation.title',
        section: 'dataManagement',
        requiredAction: 'waste-management.read',
      },
    ],
    permissions: [{ id: 'waste-management.read', titleKey: 'wasteManagement.permissions.read.title' }],
    moduleIam: {
      moduleId: 'waste-management',
      permissionIds: ['waste-management.read'],
      systemRoles: [{ roleName: 'system_admin', permissionIds: ['waste-management.read'] }],
    },
    translations: {},
  },
}));

vi.mock('../i18n', () => ({
  mergeI18nResources: mergeI18nResourcesMock,
  resetTranslatorCache: resetTranslatorCacheMock,
  t: translateMock,
}));

describe('plugin action alias lookup', () => {
  beforeEach(() => {
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
    registerPluginTranslationResolverMock.mockReset();
    mergeI18nResourcesMock.mockReset();
    resetTranslatorCacheMock.mockReset();
    translateMock.mockClear();
    vi.resetModules();
  });

  it('resolves legacy aliases and warns only once per alias', async () => {
    const {
      getStudioPluginAction,
      getStudioPluginNavigationModuleId,
      studioAdminResources,
      studioPluginCatalog,
      studioPluginCatalogIssues,
      studioPluginSnapshot,
      studioBuildTimeRegistry,
      studioModuleIamContracts,
      studioModuleIamRegistry,
    } = await import('./plugins');

    const first = getStudioPluginAction('create');
    const second = getStudioPluginAction('create');

    expect(first).toMatchObject({
      actionId: 'news.create',
      deprecatedAlias: 'create',
    });
    expect(second).toMatchObject({
      actionId: 'news.create',
      deprecatedAlias: 'create',
    });

    expect(browserLoggerMock.warn).toHaveBeenCalledTimes(1);
    expect(browserLoggerMock.warn).toHaveBeenCalledWith('plugin_action_alias_deprecated', {
      requested_action_id: 'create',
      canonical_action_id: 'news.create',
      owner_plugin_id: 'news',
    });

    expect(studioBuildTimeRegistry.plugins).toHaveLength(4);
    expect(studioPluginCatalogIssues).toEqual([]);
    expect(studioPluginCatalog.map((entry) => entry.pluginId)).toEqual(['news', 'events', 'poi', 'waste-management']);
    expect(studioPluginCatalog.every((entry) => entry.sourceType === 'workspace' && entry.enabled)).toBe(true);
    expect(studioPluginSnapshot.registry).toBe(studioBuildTimeRegistry);
    expect(studioPluginSnapshot.pluginSources.map((source) => source.pluginId)).toEqual([
      'news',
      'events',
      'poi',
      'waste-management',
    ]);
    expect(studioBuildTimeRegistry.routes.length).toBeGreaterThan(0);
    expect(studioBuildTimeRegistry.adminResources).toEqual(studioAdminResources);
    expect(studioModuleIamContracts.find((contract) => contract.moduleId === 'media')).toEqual(
      studioModuleIamRegistry.get('media')
    );
    expect(studioAdminResources.map((resource) => resource.resourceId)).toEqual(
      expect.arrayContaining(['news.content', 'events.content', 'poi.content'])
    );
    expect(studioAdminResources.map((resource) => resource.basePath)).toEqual(
      expect.arrayContaining(['news', 'events', 'poi'])
    );
    expect(studioBuildTimeRegistry.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'waste-management.home',
          path: '/plugins/waste-management',
          guard: 'waste-management.read',
        }),
      ])
    );
    expect(getStudioPluginNavigationModuleId({ id: 'waste-management.navigation' })).toBe('waste-management');
    expect(getStudioPluginNavigationModuleId({ id: 'unknown.navigation' })).toBeNull();
    expect(registerPluginTranslationResolverMock).toHaveBeenCalledTimes(1);
    expect(resetTranslatorCacheMock).toHaveBeenCalledTimes(1);
    expect(mergeI18nResourcesMock).toHaveBeenCalledWith(studioBuildTimeRegistry.translations);

    const translationResolver = registerPluginTranslationResolverMock.mock.calls[0]?.[0] as
      | ((key: string, variables?: Record<string, string | number>) => string)
      | undefined;
    expect(translationResolver?.('wasteManagement.navigation.title')).toBe('wasteManagement.navigation.title');
    expect(getStudioPluginAction('news.create')).toMatchObject({
      actionId: 'news.create',
    });
    expect(getStudioPluginAction('missing.action')).toBeUndefined();
    expect(browserLoggerMock.warn).toHaveBeenCalledTimes(1);
  }, 15000);

  it('logs skipped and rejected plugin catalog issues deterministically', async () => {
    vi.doMock('./plugin-catalog-loader.js', () => ({
      createStudioPluginCatalogReport: vi.fn(() => ({
        catalog: [],
        issues: [
          {
            pluginId: 'warn-plugin',
            sourceRef: 'packages/warn-plugin',
            sourceType: 'workspace',
            severity: 'warning',
            code: 'plugin_disabled',
            message: 'Warn plugin skipped.',
          },
          {
            pluginId: 'error-plugin',
            sourceRef: 'packages/error-plugin',
            sourceType: 'workspace',
            severity: 'error',
            code: 'plugin_module_missing',
            message: 'Error plugin rejected.',
          },
        ],
        snapshot: {
          pluginSources: [],
          registry: {
            plugins: [],
            pluginRegistry: new Map(),
            pluginActionRegistry: new Map(),
            pluginModuleIamRegistry: new Map(),
            pluginModuleIamContracts: [],
            routes: [],
            navigation: [],
            contentTypes: [],
            adminResources: [],
            translations: {},
            jobTypes: [],
          },
        },
      })),
      getPackagePluginModuleCandidates: vi.fn(() => []),
      getWorkspacePluginModuleCandidates: vi.fn(() => []),
    }));

    const { studioPluginCatalogIssues } = await import('./plugins');

    expect(studioPluginCatalogIssues).toHaveLength(2);
    expect(browserLoggerMock.warn).toHaveBeenCalledWith('plugin_catalog_entry_skipped', {
      plugin_id: 'warn-plugin',
      source_ref: 'packages/warn-plugin',
      source_type: 'workspace',
      reason_code: 'plugin_disabled',
      message: 'Warn plugin skipped.',
    });
    expect(browserLoggerMock.error).toHaveBeenCalledWith('plugin_catalog_entry_rejected', {
      plugin_id: 'error-plugin',
      source_ref: 'packages/error-plugin',
      source_type: 'workspace',
      reason_code: 'plugin_module_missing',
      message: 'Error plugin rejected.',
    });
  });

  it('covers unresolved manifest and plugin-module branches for workspace and package sources', async () => {
    const resolveManifestResults: unknown[] = [];
    const resolvePluginModuleResults: unknown[] = [];

    vi.doMock('./plugin-catalog-loader.js', () => ({
      createStudioPluginCatalogReport: vi.fn(async (input: {
        resolveManifest: (entry: { sourceType: 'workspace' | 'package'; sourceRef: string }) => unknown;
        resolvePluginModule: (
          entry: { sourceType: 'workspace' | 'package'; sourceRef: string },
          manifest: { entry?: string }
        ) => Promise<unknown>;
      }) => {
        resolveManifestResults.push(
          input.resolveManifest({ sourceType: 'workspace', sourceRef: 'packages/missing-plugin' }),
          input.resolveManifest({ sourceType: 'package', sourceRef: '@missing/plugin' })
        );
        resolvePluginModuleResults.push(
          await input.resolvePluginModule(
            { sourceType: 'workspace', sourceRef: 'packages/missing-plugin' },
            { entry: './src/missing.ts' }
          ),
          await input.resolvePluginModule(
            { sourceType: 'package', sourceRef: '@missing/plugin' },
            { entry: './dist/missing.js' }
          )
        );

        return {
          catalog: [],
          issues: [],
          snapshot: {
            pluginSources: [],
            registry: {
              plugins: [],
              pluginRegistry: new Map(),
              pluginActionRegistry: new Map(),
              pluginModuleIamRegistry: new Map(),
              pluginModuleIamContracts: [],
              routes: [],
              navigation: [],
              contentTypes: [],
              adminResources: [],
              translations: {},
              jobTypes: [],
            },
          },
        };
      }),
      getPackagePluginModuleCandidates: vi.fn(() => ['./dist/missing.js']),
      getWorkspacePluginModuleCandidates: vi.fn(() => ['./src/missing.ts']),
    }));

    const { studioPluginCatalog } = await import('./plugins');

    expect(studioPluginCatalog).toEqual([]);
    expect(resolveManifestResults).toEqual([undefined, undefined]);
    expect(resolvePluginModuleResults).toEqual([undefined, undefined]);
  });

  it('restricts node-module plugin imports to the plugin package naming scheme', () => {
    const currentFilePath = fileURLToPath(import.meta.url);
    const source = readFileSync(resolve(dirname(currentFilePath), 'plugins.ts'), 'utf8');

    expect(source).toContain("node_modules/plugin-*/dist/index.js");
    expect(source).toContain("node_modules/@*/plugin-*/dist/index.js");
    expect(source).not.toContain("node_modules/*/dist/index.js");
    expect(source).not.toContain("node_modules/@*/*/dist/index.js");
  });
});
