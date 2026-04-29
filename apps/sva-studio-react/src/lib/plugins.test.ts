import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/plugin-news', () => ({
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
        contentUi: {
          contentType: 'news.article',
          bindings: {
            list: { bindingKey: 'newsList' },
            detail: { bindingKey: 'newsDetail' },
            editor: { bindingKey: 'newsEditor' },
          },
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
    permissions: [
      { id: 'news.read', titleKey: 'news.permissions.read' },
      { id: 'news.create', titleKey: 'news.permissions.create' },
    ],
  },
}));

vi.mock('@sva/plugin-events', () => ({
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
        contentUi: {
          contentType: 'events.event-record',
          bindings: {
            list: { bindingKey: 'eventsList' },
            detail: { bindingKey: 'eventsDetail' },
            editor: { bindingKey: 'eventsEditor' },
          },
        },
      },
    ],
  },
}));

vi.mock('@sva/plugin-poi', () => ({
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
        contentUi: {
          contentType: 'poi.point-of-interest',
          bindings: {
            list: { bindingKey: 'poiList' },
            detail: { bindingKey: 'poiDetail' },
            editor: { bindingKey: 'poiEditor' },
          },
        },
      },
    ],
  },
}));

vi.mock('@sva/monitoring-client/logging', () => {
  return {
    createBrowserLogger: () => browserLoggerMock,
  };
});

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
    const { getStudioPluginAction, studioAdminResources, studioBuildTimeRegistry } = await import('./plugins');

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

    expect(studioBuildTimeRegistry.plugins).toHaveLength(3);
    expect(studioBuildTimeRegistry.routes).toHaveLength(0);
    expect(studioBuildTimeRegistry.adminResources).toEqual(studioAdminResources);
    expect(studioAdminResources.find((resource) => resource.resourceId === 'content')).toMatchObject({
      resourceId: 'content',
      basePath: 'content',
      capabilities: {
        list: {
          search: {
            param: 'q',
            fields: ['title', 'author', 'contentType', 'payload'],
          },
          filters: [
            {
              id: 'status',
              param: 'status',
              defaultValue: 'all',
            },
          ],
          sorting: {
            defaultField: 'updatedAt',
            defaultDirection: 'desc',
          },
          pagination: {
            defaultPageSize: 25,
          },
          bulkActions: [
            {
              id: 'archive',
              actionId: 'content.archive',
              selectionModes: ['explicitIds', 'currentPage', 'allMatchingQuery'],
            },
            {
              id: 'delete',
              actionId: 'content.delete',
              selectionModes: ['explicitIds'],
            },
          ],
        },
        detail: {
          history: {
            bindingKey: 'content.history',
          },
          revisions: {
            restoreActionId: 'content.restore',
          },
        },
      },
    });
    expect(studioAdminResources.map((resource) => resource.basePath)).toEqual(['news', 'events', 'poi', 'content']);
  });
});
