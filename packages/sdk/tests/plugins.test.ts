import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createPluginRegistry,
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
  });

  it('merges route, navigation, content type and translations', () => {
    expect(mergePluginRouteDefinitions([pluginA])).toHaveLength(1);
    expect(mergePluginNavigationItems([pluginA])).toHaveLength(1);
    expect(mergePluginContentTypes([pluginA])).toHaveLength(1);
    expect(mergePluginTranslations([pluginA])).toEqual(pluginA.translations);
  });

  it('exposes a typed public plugin contract', () => {
    expectTypeOf(pluginA).toMatchTypeOf<PluginDefinition>();
    expectTypeOf<(typeof pluginA.routes)[number]['guard']>().toEqualTypeOf<'content.read' | undefined>();
    expectTypeOf<(typeof pluginA.navigation)[number]['section']>().toEqualTypeOf<'dataManagement'>();
  });
});
