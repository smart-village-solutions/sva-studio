import { beforeEach, describe, expect, it, vi } from 'vitest';
const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

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
  mergeI18nResources: vi.fn(),
  resetTranslatorCache: vi.fn(),
  t: vi.fn((key: string) => key),
}));

describe('plugin action alias lookup', () => {
  beforeEach(() => {
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
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
});
