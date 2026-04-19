import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createPluginActionRegistry,
  createPluginRegistry,
  definePluginActions,
  mergePluginActions,
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
    contentTypes: [{ contentType: 'news', displayName: 'News' }],
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
    expect(mergePluginTranslations([pluginA])).toEqual(pluginA.translations);
  });

  it('merges nested translations and tolerates omitted optional plugin sections', () => {
    const registry = createPluginRegistry([
      pluginA,
      {
        id: 'example',
        displayName: 'Example',
        routes: [{ id: 'example.list', path: '/plugins/example', component: (() => null) as never }],
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

    expect(Array.from(registry.keys())).toEqual(['news', 'example', 'news-override']);
    expect(mergePluginNavigationItems(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginActions(Array.from(registry.values()))).toHaveLength(1);
    expect(mergePluginContentTypes(Array.from(registry.values()))).toHaveLength(1);
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

  it('enforces namespace isolation for plugin actions', () => {
    expect(() => definePluginActions('   ', [])).toThrow('invalid_plugin_action_namespace');

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
