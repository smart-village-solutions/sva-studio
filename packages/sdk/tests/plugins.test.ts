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
    const registry = createPluginRegistry([pluginA]);

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
  });
});
