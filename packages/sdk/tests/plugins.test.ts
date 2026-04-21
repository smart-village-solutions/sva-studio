import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createBuildTimeRegistry,
  createAdminResourceRegistry,
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginRegistry,
  definePluginAdminResources,
  definePluginActions,
  definePluginAuditEvents,
  definePluginContentTypes,
  mergePluginActions,
  mergeAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  type PluginDefinition,
} from '../src/index.js';

describe('plugin registry', () => {
  const pluginA = {
    id: 'news',
    displayName: 'News',
    routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
    navigation: [{ id: 'news.nav', to: '/plugins/news', titleKey: 'news.navigation.title', section: 'dataManagement' as const }],
    actions: definePluginActions('news', [
      {
        id: 'news.publish',
        titleKey: 'news.actions.publish',
        requiredAction: 'content.write',
      },
    ]),
    contentTypes: definePluginContentTypes('news', [{ contentType: 'news.article', displayName: 'News' }]),
    auditEvents: definePluginAuditEvents('news', [{ eventType: 'news.published', titleKey: 'news.audit.published' }]),
    translations: {
      de: {
        news: {
          navigation: {
            title: 'News',
          },
        },
      },
    },
  } as const;

  it('registers valid plugins', () => {
    const registry = createPluginRegistry([
      {
        ...pluginA,
        routes: [
          ...pluginA.routes,
          {
            id: 'news.create.route',
            path: '/plugins/news/new',
            guard: 'content.write',
            actionId: 'news.publish',
            component: (() => null) as never,
          },
        ],
        navigation: [
          ...(pluginA.navigation ?? []),
          {
            id: 'news.publish.nav',
            to: '/plugins/news/publish',
            titleKey: 'news.actions.publish',
            section: 'dataManagement' as const,
            actionId: 'news.publish',
            requiredAction: 'content.write',
          },
        ],
      },
    ]);

    expect(registry.get('news')).toMatchObject({
      id: 'news',
      displayName: 'News',
    });
  });

  it('rejects invalid and duplicate plugins', () => {
    expect(() =>
      createPluginRegistry([
        pluginA,
        {
          ...pluginA,
          id: 'news',
          displayName: 'Other',
        },
      ])
    ).toThrow('duplicate_plugin:news');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          id: '   ',
        },
      ])
    ).toThrow('invalid_plugin_definition');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          id: 'News Plugin',
        },
      ])
    ).toThrow('invalid_plugin_namespace:News Plugin');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          displayName: '   ',
        },
      ])
    ).toThrow('invalid_plugin_definition');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          routes: [
            {
              id: 'news.invalid-route',
              path: '/plugins/news/invalid',
              guard: 'content.read',
              actionId: 'events.publish',
              component: (() => null) as never,
            },
          ],
        },
      ])
    ).toThrow('plugin_route_action_owner_mismatch:news:news.invalid-route:events.publish');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          routes: [
            {
              id: 'news.missing-route-action',
              path: '/plugins/news/missing',
              actionId: 'news.archive',
              component: (() => null) as never,
            },
          ],
        },
      ])
    ).toThrow('plugin_route_action_missing:news:news.missing-route-action:news.archive');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          routes: [
            {
              id: 'news.missing-route-guard',
              path: '/plugins/news/missing-guard',
              actionId: 'news.publish',
              component: (() => null) as never,
            },
          ],
        },
      ])
    ).toThrow('plugin_route_action_guard_mismatch:news:news.missing-route-guard:news.publish');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          routes: [
            {
              id: 'news.mismatched-route-guard',
              path: '/plugins/news/mismatch',
              guard: 'content.read',
              actionId: 'news.publish',
              component: (() => null) as never,
            },
          ],
        },
      ])
    ).toThrow('plugin_route_action_guard_mismatch:news:news.mismatched-route-guard:news.publish');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          navigation: [
            {
              id: 'news.invalid-nav',
              to: '/plugins/news/invalid',
              titleKey: 'news.navigation.title',
              section: 'dataManagement' as const,
              actionId: 'events.publish',
            },
          ],
        },
      ])
    ).toThrow('plugin_navigation_action_owner_mismatch:news:news.invalid-nav:events.publish');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          navigation: [
            {
              id: 'news.mismatched-nav-guard',
              to: '/plugins/news/mismatch',
              titleKey: 'news.navigation.title',
              section: 'dataManagement' as const,
              actionId: 'news.publish',
              requiredAction: 'content.read',
            },
          ],
        },
      ])
    ).toThrow('plugin_navigation_action_guard_mismatch:news:news.mismatched-nav-guard:news.publish');
  });

  it('merges route, navigation, content type and translations', () => {
    expect(mergePluginRouteDefinitions([pluginA])).toHaveLength(1);
    expect(mergePluginNavigationItems([pluginA])).toHaveLength(1);
    expect(mergePluginActions([pluginA])).toHaveLength(1);
    expect(mergePluginContentTypes([pluginA])).toHaveLength(1);
    expect(mergePluginAuditEventDefinitions([pluginA])).toHaveLength(1);
    expect(mergePluginTranslations([pluginA])).toEqual(pluginA.translations);
  });

  it('merges nested translations and tolerates omitted optional plugin sections', () => {
    const registry = createPluginRegistry([
      pluginA,
      {
        id: 'calendar',
        displayName: 'Calendar',
        routes: [{ id: 'calendar.list', path: '/plugins/calendar', component: (() => null) as never }],
      },
      {
        id: 'news-override',
        displayName: 'News Override',
        routes: [{ id: 'news.override', path: '/plugins/news/override', component: (() => null) as never }],
        translations: {
          de: {
            news: {
              navigation: {
                subtitle: 'Redaktion',
              },
            },
          },
        },
      },
    ]);

    expect(Array.from(registry.keys())).toEqual(['news', 'calendar', 'news-override']);
    expect(mergePluginNavigationItems(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginActions(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginContentTypes(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginAuditEventDefinitions(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginTranslations(Array.from(registry.values()))).toEqual({
      de: {
        news: {
          navigation: {
            title: 'News',
            subtitle: 'Redaktion',
          },
        },
      },
    });
  });

  it('exposes a typed public plugin contract', () => {
    expectTypeOf(pluginA).toMatchTypeOf<PluginDefinition>();
    expectTypeOf<(typeof pluginA.routes)[number]['guard']>().toEqualTypeOf<'content.read' | undefined>();
    expectTypeOf<(typeof pluginA.navigation)[number]['section']>().toEqualTypeOf<'dataManagement'>();
  });

  it('enforces namespace isolation for plugin content types, admin resources and audit events', () => {
    expect(() =>
      definePluginContentTypes('news', [{ contentType: 'article', displayName: 'Article' }])
    ).toThrow('invalid_plugin_content_type:article');

    expect(() =>
      definePluginContentTypes('news', [{ contentType: 'events.article', displayName: 'Article' }])
    ).toThrow('plugin_content_type_namespace_mismatch:news:events:events.article');

    expect(() =>
      createPluginRegistry([
        {
          ...pluginA,
          contentTypes: [{ contentType: 'article', displayName: 'Article' }],
        },
      ])
    ).toThrow('invalid_plugin_content_type:article');

    expect(() =>
      definePluginAdminResources('news', [
        {
          resourceId: 'articles',
          basePath: 'news-articles',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'newsArticles' },
            create: { bindingKey: 'newsArticlesCreate' },
            detail: { bindingKey: 'newsArticlesDetail' },
          },
        },
      ])
    ).toThrow('invalid_plugin_admin_resource:articles');

    expect(() =>
      definePluginAdminResources('news', [
        {
          resourceId: 'events.articles',
          basePath: 'news-articles',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'newsArticles' },
            create: { bindingKey: 'newsArticlesCreate' },
            detail: { bindingKey: 'newsArticlesDetail' },
          },
        },
      ])
    ).toThrow('plugin_admin_resource_namespace_mismatch:news:events:events.articles');

    expect(() =>
      definePluginAuditEvents('news', [{ eventType: 'published', titleKey: 'news.audit.published' }])
    ).toThrow('invalid_plugin_audit_event_type:published');

    expect(() =>
      definePluginAuditEvents('news', [{ eventType: 'events.published', titleKey: 'news.audit.published' }])
    ).toThrow('plugin_audit_event_namespace_mismatch:news:events:events.published');
  });

  it('builds a namespaced action registry and rejects duplicates', () => {
    const actions = createPluginActionRegistry([pluginA]);

    expect(actions.get('news.publish')).toMatchObject({
      actionId: 'news.publish',
      namespace: 'news',
      actionName: 'publish',
      ownerPluginId: 'news',
      titleKey: 'news.actions.publish',
      requiredAction: 'content.write',
    });

    expect(() =>
      createPluginActionRegistry([
        pluginA,
        {
          ...pluginA,
          displayName: 'News Duplicate Plugin',
        },
      ])
    ).toThrow('duplicate_plugin:news');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news-duplicate',
          displayName: 'News Duplicate',
          routes: [{ id: 'news.duplicate', path: '/plugins/news-duplicate', component: (() => null) as never }],
          actions: [
            {
              id: 'news-duplicate.publish',
              titleKey: 'news-duplicate.actions.publish',
            },
            {
              id: 'news-duplicate.publish',
              titleKey: 'news-duplicate.actions.publishAgain',
            },
          ],
        },
      ])
    ).toThrow('duplicate_plugin_action:news-duplicate.publish');
  });

  it('builds a namespaced plugin audit event registry and rejects duplicates', () => {
    const auditEvents = createPluginAuditEventRegistry([pluginA]);

    expect(auditEvents.get('news.published')).toMatchObject({
      eventType: 'news.published',
      namespace: 'news',
      eventName: 'published',
      ownerPluginId: 'news',
      titleKey: 'news.audit.published',
    });

    expect(() =>
      createPluginAuditEventRegistry([
        {
          ...pluginA,
          auditEvents: [
            ...pluginA.auditEvents,
            { eventType: 'news.published', titleKey: 'news.audit.publishedAgain' },
          ],
        },
      ])
    ).toThrow('duplicate_plugin_audit_event:news.published');
  });

  it('enforces namespace isolation for plugin actions', () => {
    expect(() => definePluginActions('   ', [])).toThrow('invalid_plugin_action_namespace');
    expect(() => definePluginActions('News', [])).toThrow('invalid_plugin_namespace:News');

    expect(() => definePluginActions('core', [])).toThrow('reserved_plugin_action_namespace:core');
    expect(() => definePluginActions('content', [])).toThrow('reserved_plugin_action_namespace:content');
    expect(() => definePluginActions('iam', [])).toThrow('reserved_plugin_action_namespace:iam');

    expect(() =>
      definePluginActions('news', [
        {
          id: 'invalid',
          titleKey: 'news.actions.publish',
        },
      ])
    ).toThrow('invalid_plugin_action_id:invalid');

    expect(() =>
      definePluginActions('news', [
        {
          id: 'news.publish',
          titleKey: '   ',
        },
      ])
    ).toThrow('invalid_plugin_action_definition:news.publish');

    expect(() =>
      definePluginActions('news', [
        {
          id: 'news.publish.v2',
          titleKey: 'news.actions.publish',
        },
      ])
    ).toThrow('invalid_plugin_action_id:news.publish.v2');

    expect(
      definePluginActions('news', [
        {
          id: ' news.publish ',
          titleKey: ' news.actions.publish ',
          featureFlag: ' feature.news.publish ',
          legacyAliases: [' publish '],
        },
      ])
    ).toEqual([
      {
        id: 'news.publish',
        titleKey: 'news.actions.publish',
        featureFlag: 'feature.news.publish',
        legacyAliases: ['publish'],
      },
    ]);

    expect(() =>
      definePluginActions('news', [
        {
          id: 'events.publish',
          titleKey: 'news.actions.publish',
        },
      ])
    ).toThrow('plugin_action_namespace_mismatch:news:events:events.publish');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news',
          displayName: 'News',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
          actions: [
            {
              id: 'publish',
              titleKey: 'news.actions.publish',
            },
          ],
        },
      ])
    ).toThrow('invalid_plugin_action_id:publish');

    expect(() =>
      createPluginActionRegistry([
        {
          id: '   ',
          displayName: 'News',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
        },
      ])
    ).toThrow('invalid_plugin_definition');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news',
          displayName: '   ',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
        },
      ])
    ).toThrow('invalid_plugin_definition');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'core',
          displayName: 'Core',
          routes: [{ id: 'core.list', path: '/plugins/core', component: (() => null) as never }],
        },
      ])
    ).toThrow('reserved_plugin_action_namespace:core');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'content',
          displayName: 'Content',
          routes: [{ id: 'content.list', path: '/plugins/content', component: (() => null) as never }],
        },
      ])
    ).toThrow('reserved_plugin_action_namespace:content');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news',
          displayName: 'News',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
          actions: [
            {
              id: 'news.publish',
              titleKey: '   ',
            },
          ],
        },
      ])
    ).toThrow('invalid_plugin_action_definition:news.publish');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news',
          displayName: 'News',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
          actions: [
            {
              id: 'events.publish',
              titleKey: 'news.actions.publish',
            },
          ],
        },
      ])
    ).toThrow('plugin_action_namespace_mismatch:news:events:events.publish');
  });

  it('normalizes optional action metadata in the registry', () => {
    const actions = createPluginActionRegistry([
      {
        id: 'news',
        displayName: 'News',
        routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
        actions: [
          {
            id: 'news.archive',
            titleKey: 'news.actions.archive',
            featureFlag: ' feature.news.archive ',
          },
          {
            id: 'news.preview',
            titleKey: 'news.actions.preview',
            featureFlag: '   ',
          },
        ],
      },
    ]);

    expect(actions.get('news.archive')).toMatchObject({
      featureFlag: 'feature.news.archive',
    });

    expect(actions.get('news.preview')).toMatchObject({
      featureFlag: undefined,
    });
  });

  it('registers legacy aliases and marks deprecated alias lookups', () => {
    const actions = createPluginActionRegistry([
      {
        id: 'news',
        displayName: 'News',
        routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
        actions: [
          {
            id: 'news.publish',
            titleKey: 'news.actions.publish',
            legacyAliases: ['publish'],
          },
        ],
      },
    ]);

    expect(actions.get('news.publish')).toMatchObject({
      actionId: 'news.publish',
      legacyAliases: ['publish'],
    });

    expect(actions.get('publish')).toMatchObject({
      actionId: 'news.publish',
      legacyAliases: ['publish'],
      deprecatedAlias: 'publish',
    });
  });

  it('rejects invalid or colliding legacy aliases', () => {
    expect(() =>
      definePluginActions('news', [
        {
          id: 'news.publish',
          titleKey: 'news.actions.publish',
          legacyAliases: ['   '],
        },
      ])
    ).toThrow('invalid_plugin_action_alias:news.publish');

    expect(() =>
      definePluginActions('news', [
        {
          id: 'news.publish',
          titleKey: 'news.actions.publish',
          legacyAliases: ['events.publish'],
        },
      ])
    ).toThrow('invalid_plugin_action_alias:news.publish');

    expect(() =>
      createPluginActionRegistry([
        {
          id: 'news',
          displayName: 'News',
          routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
          actions: [
            {
              id: 'news.publish',
              titleKey: 'news.actions.publish',
              legacyAliases: ['publish'],
            },
            {
              id: 'news.archive',
              titleKey: 'news.actions.archive',
              legacyAliases: ['publish'],
            },
          ],
        },
      ])
    ).toThrow('duplicate_plugin_action:publish');
  });
});

describe('admin resource registry', () => {
  const contentResource = {
    resourceId: 'content',
    basePath: 'content',
    titleKey: 'content.page.title',
    guard: 'content',
    views: {
      list: { bindingKey: 'content' },
      create: { bindingKey: 'contentCreate' },
      detail: { bindingKey: 'contentDetail' },
    },
  } as const;

  it('registers valid admin resources and keeps optional history optional', () => {
    const registry = createAdminResourceRegistry([contentResource]);

    expect(registry.get('content')).toEqual(contentResource);
    expect(mergeAdminResourceDefinitions([contentResource])).toEqual([contentResource]);
  });

  it('rejects duplicate resource ids and colliding base paths', () => {
    expect(() =>
      createAdminResourceRegistry([
        contentResource,
        {
          ...contentResource,
          basePath: 'content-alt',
        },
      ])
    ).toThrow('duplicate_admin_resource:content');

    expect(() =>
      createAdminResourceRegistry([
        contentResource,
        {
          ...contentResource,
          resourceId: 'legal-texts',
        },
      ])
    ).toThrow('admin_resource_base_path_conflict:content:legal-texts:content');
  });
});

describe('build-time registry', () => {
  it('materializes plugin and admin contributions through a single canonical contract', () => {
    const plugin = {
      id: 'news',
      displayName: 'News',
      routes: [{ id: 'news.list', path: '/plugins/news', component: (() => null) as never }],
      navigation: [
        {
          id: 'news.navigation',
          to: '/plugins/news',
          titleKey: 'news.navigation.title',
          section: 'dataManagement' as const,
        },
      ],
      translations: {
        de: {
          news: {
            navigation: {
              title: 'News',
            },
          },
        },
      },
      contentTypes: definePluginContentTypes('news', [{ contentType: 'news.article', displayName: 'News' }]),
      auditEvents: definePluginAuditEvents('news', [{ eventType: 'news.published' }]),
      adminResources: definePluginAdminResources('news', [
        {
          resourceId: 'news.articles',
          basePath: 'news-articles',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'newsArticles' },
            create: { bindingKey: 'newsArticlesCreate' },
            detail: { bindingKey: 'newsArticlesDetail' },
          },
        },
      ]),
    } as const;

    const registry = createBuildTimeRegistry({
      plugins: [plugin],
      adminResources: [
        {
          resourceId: 'content',
          basePath: 'content',
          titleKey: 'content.page.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ],
    });

    expect(registry.plugins).toEqual([plugin]);
    expect(registry.routes).toEqual(plugin.routes);
    expect(registry.navigation).toEqual(plugin.navigation);
    expect(registry.contentTypes).toEqual(plugin.contentTypes);
    expect(registry.auditEvents).toEqual(plugin.auditEvents);
    expect(registry.translations).toEqual(plugin.translations);
    expect(registry.adminResources).toHaveLength(2);
    expect(registry.adminResourceRegistry.get('content')?.basePath).toBe('content');
    expect(registry.adminResourceRegistry.get('news.articles')?.basePath).toBe('news-articles');
    expect(registry.pluginRegistry.get('news')?.displayName).toBe('News');
    expect(registry.pluginAuditEventRegistry.get('news.published')?.ownerPluginId).toBe('news');
  });
});
