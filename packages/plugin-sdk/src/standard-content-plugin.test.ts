import { describe, expect, it } from 'vitest';

import {
  createStandardContentAdminResource,
  createStandardContentModuleIamContract,
  createStandardContentPluginActions,
  createStandardContentPluginContribution,
  createStandardContentPluginPermissions,
  createStandardContentPluginSystemRoles,
  createStandardContentPluginActionIds,
} from './index.js';

describe('standard content plugin helpers', () => {
  it('builds canonical action ids, actions, permissions and module iam contracts', () => {
    const actionIds = createStandardContentPluginActionIds('news');
    const actions = createStandardContentPluginActions('news', {
      legacyAliases: {
        create: ['create'],
        update: ['save', 'update'],
      },
    });
    const permissions = createStandardContentPluginPermissions('news');
    const moduleIam = createStandardContentModuleIamContract('news');

    expect(actionIds).toEqual({
      create: 'news.create',
      edit: 'news.edit',
      update: 'news.update',
      delete: 'news.delete',
    });
    expect(actions).toEqual([
      {
        id: 'news.create',
        titleKey: 'news.actions.create',
        requiredAction: 'news.create',
        legacyAliases: ['create'],
      },
      {
        id: 'news.edit',
        titleKey: 'news.actions.edit',
        requiredAction: 'news.read',
      },
      {
        id: 'news.update',
        titleKey: 'news.actions.update',
        requiredAction: 'news.update',
        legacyAliases: ['save', 'update'],
      },
      {
        id: 'news.delete',
        titleKey: 'news.actions.delete',
        requiredAction: 'news.delete',
      },
    ]);
    expect(permissions).toEqual([
      { id: 'news.read', titleKey: 'news.permissions.read' },
      { id: 'news.create', titleKey: 'news.permissions.create' },
      { id: 'news.update', titleKey: 'news.permissions.update' },
      { id: 'news.delete', titleKey: 'news.permissions.delete' },
    ]);
    expect(moduleIam).toEqual({
      moduleId: 'news',
      permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
      systemRoles: createStandardContentPluginSystemRoles('news'),
    });
  });

  it('builds the canonical host-owned admin resource wiring for standard content plugins', () => {
    expect(
      createStandardContentAdminResource({
        pluginId: 'events',
        titleKey: 'events.navigation.title',
        contentType: 'events.event-record',
        listBindingKey: 'eventsList',
        detailBindingKey: 'eventsDetail',
        editorBindingKey: 'eventsEditor',
      })
    ).toEqual({
      resourceId: 'events.content',
      basePath: 'events',
      titleKey: 'events.navigation.title',
      guard: 'content',
      moduleId: 'events',
      views: {
        list: { bindingKey: 'content' },
        create: { bindingKey: 'contentCreate' },
        detail: { bindingKey: 'contentDetail' },
      },
      permissions: {
        list: ['events.read'],
        create: ['events.create'],
        detail: ['events.read'],
      },
      capabilities: {
        list: {
          pagination: {
            pageParam: 'page',
            pageSizeParam: 'pageSize',
            defaultPageSize: 25,
            pageSizeOptions: [25, 50, 100],
          },
        },
      },
      contentUi: {
        contentType: 'events.event-record',
        bindings: {
          list: { bindingKey: 'eventsList' },
          detail: { bindingKey: 'eventsDetail' },
          editor: { bindingKey: 'eventsEditor' },
        },
      },
    });
  });

  it('keeps detail access readable for read-only roles', () => {
    expect(
      createStandardContentAdminResource({
        pluginId: 'news',
        titleKey: 'news.navigation.title',
        contentType: 'news.article',
        listBindingKey: 'newsList',
        detailBindingKey: 'newsDetail',
        editorBindingKey: 'newsEditor',
      }).permissions?.detail
    ).toEqual(['news.read']);
  });

  it('builds a complete standard plugin contribution without plugin-to-plugin coupling', () => {
    expect(
      createStandardContentPluginContribution({
        pluginId: 'poi',
        displayName: 'POI',
        contentType: 'poi.point-of-interest',
        titleKey: 'poi.navigation.title',
        listBindingKey: 'poiList',
        detailBindingKey: 'poiDetail',
        editorBindingKey: 'poiEditor',
      })
    ).toMatchObject({
      navigation: [
        {
          id: 'poi.navigation',
          to: '/admin/poi',
          titleKey: 'poi.navigation.title',
          section: 'dataManagement',
          requiredAction: 'poi.read',
        },
      ],
      actions: [{ id: 'poi.create' }, { id: 'poi.edit' }, { id: 'poi.update' }, { id: 'poi.delete' }],
      permissions: [{ id: 'poi.read' }, { id: 'poi.create' }, { id: 'poi.update' }, { id: 'poi.delete' }],
      contentTypes: [{ contentType: 'poi.point-of-interest', displayName: 'POI' }],
      adminResources: [{ resourceId: 'poi.content', basePath: 'poi' }],
    });
  });
});
