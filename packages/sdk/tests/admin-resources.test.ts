import { describe, expect, it } from 'vitest';

import { createAdminResourceRegistry, definePluginAdminResources } from '../src/admin-resources.js';

describe('admin resources', () => {
  it('normalizes base paths without regex-dependent slash trimming', () => {
    const registry = createAdminResourceRegistry([
      {
        resourceId: 'news.articles',
        basePath: '///news///',
        titleKey: 'news.articles.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ]);

    expect(registry.get('news.articles')?.basePath).toBe('news');
  });

  it('rejects empty or nested admin resource base paths', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          resourceId: 'news.articles',
          basePath: '////',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_base_path');

    expect(() =>
      createAdminResourceRegistry([
        {
          resourceId: 'news.articles',
          basePath: '/news/articles/',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_base_path:news/articles');
  });

  it('enforces namespaced plugin admin resource ids and reserved namespaces', () => {
    expect(() =>
      definePluginAdminResources('', [
        {
          resourceId: 'news.articles',
          basePath: 'news',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('invalid_plugin_namespace');

    expect(() =>
      definePluginAdminResources('news', [
        {
          resourceId: 'articles',
          basePath: 'news',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('invalid_plugin_admin_resource:articles');

    expect(() =>
      definePluginAdminResources('news', [
        {
          resourceId: 'events.articles',
          basePath: 'news',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('plugin_admin_resource_namespace_mismatch:news:events:events.articles');

    expect(() =>
      definePluginAdminResources('content', [
        {
          resourceId: 'content.articles',
          basePath: 'content',
          titleKey: 'content.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('reserved_plugin_namespace:content');
  });

  it('rejects empty titles and invalid view bindings during normalization', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          resourceId: 'news.articles',
          basePath: 'news',
          titleKey: '   ',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_definition');

    expect(() =>
      createAdminResourceRegistry([
        {
          resourceId: 'news.articles',
          basePath: 'news',
          titleKey: 'news.articles.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: '' },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_view:news.articles:detail');
  });
});
