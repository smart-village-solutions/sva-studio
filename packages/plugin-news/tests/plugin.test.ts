import { describe, expect, it } from 'vitest';

import { pluginNews, pluginNewsActionDefinitions, pluginNewsPermissionDefinitions } from '../src/plugin.js';

describe('pluginNews contract', () => {
  it('keeps the canonical standard content contract', () => {
    expect(pluginNews.navigation).toEqual([
      {
        id: 'news.navigation',
        to: '/admin/news',
        titleKey: 'news.navigation.title',
        section: 'dataManagement',
        requiredAction: 'news.read',
      },
    ]);
    expect(pluginNews.actions).toEqual(pluginNewsActionDefinitions);
    expect(pluginNews.permissions).toEqual(pluginNewsPermissionDefinitions);
    expect(pluginNews.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'news.content',
        basePath: 'news',
        contentUi: {
          contentType: 'news.article',
          bindings: {
            list: { bindingKey: 'newsList' },
            detail: { bindingKey: 'newsDetail' },
            editor: { bindingKey: 'newsEditor' },
          },
        },
      }),
    ]);
  });
});
