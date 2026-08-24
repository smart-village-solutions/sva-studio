import type { AdminResourceDefinition, PluginDefinition } from '@sva/plugin-sdk';
import { describe, expect, it } from 'vitest';

import type { AppRouteBindings } from './app-route-bindings.js';
import { collectDocumentationPageCatalog } from './documentation-page-catalog.js';

const component = () => null;
const bindings = new Proxy(
  {},
  {
    get: () => component,
    getOwnPropertyDescriptor: () => ({ configurable: true, value: component }),
  }
) as AppRouteBindings;

const resource: AdminResourceDefinition = {
  resourceId: 'catalog.entries',
  basePath: 'catalog-entries',
  titleKey: 'catalog.entries.title',
  guard: 'content',
  views: {
    list: { bindingKey: 'content' },
    create: { bindingKey: 'contentCreate' },
    detail: { bindingKey: 'contentDetail' },
    history: { bindingKey: 'contentDetail' },
  },
};

const plugin: PluginDefinition = {
  id: 'catalog',
  displayName: 'Catalog',
  routes: [
    {
      id: 'catalog.dashboard',
      path: '/plugins/catalog',
      documentation: { kind: 'page', id: 'catalog.dashboard', pageType: 'overview' },
      component,
    },
  ],
};

describe('documentation page catalog', () => {
  it('collects static, materialized admin-resource and free plugin pages only', () => {
    const catalog = collectDocumentationPageCatalog({
      bindings,
      adminResources: [resource],
      plugins: [plugin],
    });
    const ids = catalog.pages.map((page) => page.id);

    expect(ids).toContain('home.overview');
    expect(ids).toContain('catalog.entries.list');
    expect(ids).toContain('catalog.entries.create');
    expect(ids).toContain('catalog.entries.detail');
    expect(ids).toContain('catalog.entries.history');
    expect(ids).toContain('catalog.dashboard');
    expect(catalog.pages.some((page) => page.path === '/help')).toBe(false);
    expect(catalog.pages).toEqual([...catalog.pages].sort((a, b) => a.id.localeCompare(b.id, 'en')));
  });

  it('supports the host-only catalog defaults', () => {
    const catalog = collectDocumentationPageCatalog({ bindings });

    expect(catalog.pages).toContainEqual(
      expect.objectContaining({ id: 'home.overview', owner: { kind: 'host' } })
    );
  });

  it('rejects plugin routes without an explicit documentation decision', () => {
    const undocumentedPlugin: PluginDefinition = {
      ...plugin,
      routes: [{ id: 'catalog.undocumented', path: '/plugins/catalog/undocumented', component }],
    };

    expect(() =>
      collectDocumentationPageCatalog({ bindings, plugins: [undocumentedPlugin] })
    ).toThrow('plugin_route_documentation_missing:catalog:catalog.undocumented');
  });

  it('omits explicitly excluded plugin routes', () => {
    const excludedPlugin: PluginDefinition = {
      ...plugin,
      routes: [
        {
          id: 'catalog.technical',
          path: '/plugins/catalog/technical',
          documentation: { kind: 'excluded', reason: 'technical' },
          component,
        },
      ],
    };

    expect(collectDocumentationPageCatalog({ bindings, plugins: [excludedPlugin] }).pages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'catalog.technical' })])
    );
  });
});
